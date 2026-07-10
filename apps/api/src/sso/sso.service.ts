import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type {
  OidcConfig,
  SamlConfig,
  SsoDiscoveryResult,
  SsoProvider,
  SsoProviderRequest,
} from "@justmail/contracts";
import { config } from "../config";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuthService, type SessionPrincipal } from "../auth/auth.service";
import { open, seal } from "../common/secretbox";
import {
  buildAuthUrl,
  discover,
  exchangeCode,
  pkcePair,
  verifyIdToken,
} from "./oidc";
import { samlAuthorizeUrl, samlMetadata, samlValidateResponse } from "./saml";

interface ProviderRow {
  id: string;
  org_id: string;
  kind: "oidc" | "saml";
  name: string;
  enabled: boolean;
  email_domain: string | null;
  auto_provision: boolean;
  default_role: string;
  config: OidcConfig | SamlConfig;
  secret_enc: string | null;
  created_at: Date;
  updated_at: Date;
}

interface FlowRow {
  id: string;
  provider_id: string;
  state: string;
  code_verifier: string | null;
  nonce: string | null;
  relay_target: string;
  expires_at: Date;
}

export interface SsoSessionResult {
  token: string;
  expiresAt: Date;
  relay: string;
}

@Injectable()
export class SsoService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly orgs: OrgsService,
    private readonly auth: AuthService,
  ) {}

  // ── URL derivation ────────────────────────────────────────────────────────
  private callbackBase(): string {
    const base =
      config.SSO_CALLBACK_BASE_URL ??
      (config.JM_API_HOST ? `https://${config.JM_API_HOST}` : null);
    if (!base) {
      throw new ServiceUnavailableException({
        title: "SSO is not configured",
        detail: "Set SSO_CALLBACK_BASE_URL or JM_API_HOST to enable SSO.",
      });
    }
    return base.replace(/\/$/, "");
  }

  private endpoints(id: string) {
    const base = this.callbackBase();
    return {
      login_url: `${base}/v1/auth/sso/${id}/start`,
      callback_url: `${base}/v1/auth/sso/${id}/callback`,
      acs_url: `${base}/v1/auth/sso/${id}/acs`,
      metadata_url: `${base}/v1/auth/sso/${id}/metadata`,
    };
  }

  private allowedRelayOrigins(): Set<string> {
    return new Set(
      [config.JM_ADMIN_HOST, config.JM_WEBMAIL_HOST, config.JM_WEB_HOST]
        .filter((h): h is string => !!h)
        .map((h) => `https://${h}`),
    );
  }

  private defaultRelay(): string {
    if (config.SSO_DEFAULT_RELAY_URL) return config.SSO_DEFAULT_RELAY_URL;
    const host = config.JM_ADMIN_HOST ?? config.JM_WEB_HOST;
    if (host) return `https://${host}`;
    // Dev fallback: send the user back to the API base.
    return this.callbackBase();
  }

  private resolveRelay(requested?: string): string {
    if (!requested) return this.defaultRelay();
    try {
      const url = new URL(requested);
      if (this.allowedRelayOrigins().has(url.origin)) return requested;
    } catch {
      // fall through to default on malformed input
    }
    return this.defaultRelay();
  }

  // ── Admin: provider CRUD ──────────────────────────────────────────────────
  private toProvider(row: ProviderRow): SsoProvider {
    const ep = this.endpoints(row.id);
    return {
      id: row.id,
      org_id: row.org_id,
      kind: row.kind,
      name: row.name,
      enabled: row.enabled,
      email_domain: row.email_domain,
      auto_provision: row.auto_provision,
      default_role: row.default_role as SsoProvider["default_role"],
      oidc: row.kind === "oidc" ? (row.config as OidcConfig) : null,
      saml: row.kind === "saml" ? (row.config as SamlConfig) : null,
      has_secret: row.secret_enc !== null,
      login_url: ep.login_url,
      callback_url: ep.callback_url,
      acs_url: ep.acs_url,
      metadata_url: ep.metadata_url,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  async list(orgId: string, userId: string): Promise<SsoProvider[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<ProviderRow>(
      `SELECT * FROM sso_providers WHERE org_id = $1 ORDER BY created_at`,
      [orgId],
    );
    return rows.map((r) => this.toProvider(r));
  }

  async get(orgId: string, userId: string, id: string): Promise<SsoProvider> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const row = await this.loadOwned(orgId, id);
    return this.toProvider(row);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    req: SsoProviderRequest,
    ip?: string,
  ): Promise<SsoProvider> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { cfg, secret } = splitRequest(req);
    const { rows } = await this.db.query<ProviderRow>(
      `INSERT INTO sso_providers
         (org_id, kind, name, enabled, email_domain, auto_provision,
          default_role, config, secret_enc, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        orgId,
        req.kind,
        req.name,
        req.enabled,
        req.email_domain ?? null,
        req.auto_provision,
        req.default_role,
        JSON.stringify(cfg),
        secret ? seal(secret) : null,
        principal.userId,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "sso.provider.create",
      targetType: "sso_provider",
      targetId: rows[0]!.id,
      meta: { kind: req.kind },
      ip,
    });
    return this.toProvider(rows[0]!);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    req: SsoProviderRequest,
    ip?: string,
  ): Promise<SsoProvider> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const existing = await this.loadOwned(orgId, id);
    if (existing.kind !== req.kind) {
      throw new BadRequestException({
        title: "Provider kind is immutable",
        detail: "Delete and recreate to switch between OIDC and SAML.",
      });
    }
    const { cfg, secret } = splitRequest(req);
    // OIDC: omit client_secret to keep the stored value; empty string clears it.
    const secretSql =
      req.kind === "oidc" && req.client_secret === undefined
        ? existing.secret_enc
        : secret
          ? seal(secret)
          : null;
    const { rows } = await this.db.query<ProviderRow>(
      `UPDATE sso_providers SET
         name = $3, enabled = $4, email_domain = $5, auto_provision = $6,
         default_role = $7, config = $8, secret_enc = $9, updated_at = now()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [
        id,
        orgId,
        req.name,
        req.enabled,
        req.email_domain ?? null,
        req.auto_provision,
        req.default_role,
        JSON.stringify(cfg),
        secretSql,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "sso.provider.update",
      targetType: "sso_provider",
      targetId: id,
      ip,
    });
    return this.toProvider(rows[0]!);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rowCount } = await this.db.query(
      "DELETE FROM sso_providers WHERE id = $1 AND org_id = $2",
      [id, orgId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Provider not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "sso.provider.delete",
      targetType: "sso_provider",
      targetId: id,
      ip,
    });
  }

  private async loadOwned(orgId: string, id: string): Promise<ProviderRow> {
    const { rows } = await this.db.query<ProviderRow>(
      "SELECT * FROM sso_providers WHERE id = $1 AND org_id = $2",
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Provider not found" });
    return rows[0];
  }

  private async loadEnabled(id: string): Promise<ProviderRow> {
    const { rows } = await this.db.query<ProviderRow>(
      "SELECT * FROM sso_providers WHERE id = $1 AND enabled = true",
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException({ title: "SSO provider not found" });
    }
    return rows[0];
  }

  // ── Login-page discovery ──────────────────────────────────────────────────
  async discoverForEmail(email: string): Promise<SsoDiscoveryResult> {
    const at = email.lastIndexOf("@");
    if (at < 0) return { provider: null };
    const domain = email.slice(at + 1).toLowerCase();
    const { rows } = await this.db.query<ProviderRow>(
      `SELECT * FROM sso_providers
       WHERE enabled = true AND lower(email_domain) = $1 LIMIT 1`,
      [domain],
    );
    const row = rows[0];
    if (!row) return { provider: null };
    return {
      provider: {
        provider_id: row.id,
        kind: row.kind,
        name: row.name,
        login_url: this.endpoints(row.id).login_url,
      },
    };
  }

  // ── Login flow ────────────────────────────────────────────────────────────
  async beginLogin(id: string, relay?: string): Promise<string> {
    const provider = await this.loadEnabled(id);
    const relayTarget = this.resolveRelay(relay);
    const state = randomBytes(24).toString("base64url");
    const expiresAt = new Date(
      Date.now() + config.SSO_FLOW_TTL_SECONDS * 1000,
    );

    if (provider.kind === "oidc") {
      const cfg = provider.config as OidcConfig;
      const disc = await discover(cfg.issuer);
      const { verifier, challenge } = pkcePair();
      const nonce = randomBytes(16).toString("base64url");
      await this.db.query(
        `INSERT INTO sso_login_flows
           (provider_id, state, code_verifier, nonce, relay_target, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, state, verifier, nonce, relayTarget, expiresAt],
      );
      return buildAuthUrl({
        authorizationEndpoint: disc.authorization_endpoint,
        clientId: cfg.client_id,
        redirectUri: this.endpoints(id).callback_url,
        scopes: cfg.scopes,
        state,
        nonce,
        codeChallenge: challenge,
      });
    }

    const cfg = provider.config as SamlConfig;
    await this.db.query(
      `INSERT INTO sso_login_flows (provider_id, state, relay_target, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [id, state, relayTarget, expiresAt],
    );
    return samlAuthorizeUrl(cfg, this.samlSp(id), state);
  }

  private samlSp(id: string) {
    const ep = this.endpoints(id);
    return { spEntityId: ep.metadata_url, acsUrl: ep.acs_url };
  }

  async metadataXml(id: string): Promise<string> {
    const provider = await this.loadEnabled(id);
    if (provider.kind !== "saml") {
      throw new NotFoundException({ title: "Not a SAML provider" });
    }
    return samlMetadata(provider.config as SamlConfig, this.samlSp(id));
  }

  loginErrorRedirect(): string {
    return `${this.defaultRelay()}/login?sso_error=1`;
  }

  private async consumeFlow(state: string): Promise<FlowRow | null> {
    const { rows } = await this.db.query<FlowRow>(
      "DELETE FROM sso_login_flows WHERE state = $1 RETURNING *",
      [state],
    );
    const flow = rows[0];
    if (!flow) return null;
    if (flow.expires_at.getTime() < Date.now()) return null;
    return flow;
  }

  async completeOidc(
    id: string,
    code: string,
    state: string,
    ip?: string,
    userAgent?: string,
  ): Promise<SsoSessionResult> {
    const flow = await this.consumeFlow(state);
    if (!flow || flow.provider_id !== id) {
      throw new UnauthorizedException({ title: "SSO login session expired" });
    }
    const provider = await this.loadEnabled(id);
    const cfg = provider.config as OidcConfig;
    const disc = await discover(cfg.issuer);
    const tokens = await exchangeCode({
      tokenEndpoint: disc.token_endpoint,
      clientId: cfg.client_id,
      clientSecret: provider.secret_enc ? open(provider.secret_enc) : undefined,
      code,
      redirectUri: this.endpoints(id).callback_url,
      codeVerifier: flow.code_verifier ?? "",
    });
    if (!tokens.id_token) {
      throw new UnauthorizedException({ title: "IdP returned no id_token" });
    }
    const claims = await verifyIdToken({
      idToken: tokens.id_token,
      jwksUri: disc.jwks_uri,
      issuer: disc.issuer,
      clientId: cfg.client_id,
      nonce: flow.nonce ?? "",
    });
    const email = claims[cfg.email_claim];
    const name = claims[cfg.name_claim];
    const session = await this.provisionAndSession(
      provider,
      {
        subject: claims.sub,
        email: typeof email === "string" ? email : undefined,
        name: typeof name === "string" ? name : undefined,
      },
      ip,
      userAgent,
    );
    return { ...session, relay: flow.relay_target };
  }

  async completeSaml(
    id: string,
    samlResponse: string,
    relayState?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<SsoSessionResult> {
    const provider = await this.loadEnabled(id);
    const cfg = provider.config as SamlConfig;
    const result = await samlValidateResponse(
      cfg,
      this.samlSp(id),
      samlResponse,
    );
    if (cfg.idp_issuer && result.issuer && result.issuer !== cfg.idp_issuer) {
      throw new UnauthorizedException({ title: "SAML issuer mismatch" });
    }

    let relay = this.defaultRelay();
    if (relayState) {
      const flow = await this.consumeFlow(relayState);
      if (flow && flow.provider_id === id) relay = flow.relay_target;
    }

    const session = await this.provisionAndSession(
      provider,
      { subject: result.subject, email: result.email, name: result.name },
      ip,
      userAgent,
    );
    return { ...session, relay };
  }

  // Resolve (or provision) the local user for an external identity, then mint a
  // session. Identities are keyed by (provider, subject); an unlinked subject is
  // matched to an existing account by verified email, or provisioned on demand.
  private async provisionAndSession(
    provider: ProviderRow,
    identity: { subject: string; email?: string; name?: string },
    ip?: string,
    userAgent?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const userId = await this.db.tx(async (tx) => {
      const linked = await tx.query<{ user_id: string; status: string }>(
        `SELECT i.user_id, u.status
         FROM sso_identities i JOIN users u ON u.id = i.user_id
         WHERE i.provider_id = $1 AND i.subject = $2`,
        [provider.id, identity.subject],
      );
      if (linked.rows[0]) {
        if (linked.rows[0].status !== "active") {
          throw new ForbiddenException({ title: "Account suspended" });
        }
        await tx.query(
          "UPDATE sso_identities SET last_login_at = now() WHERE provider_id = $1 AND subject = $2",
          [provider.id, identity.subject],
        );
        return linked.rows[0].user_id;
      }

      let uid: string;
      const existing = identity.email
        ? await tx.query<{ id: string; status: string }>(
            "SELECT id, status FROM users WHERE email = $1",
            [identity.email],
          )
        : { rows: [] as { id: string; status: string }[] };

      if (existing.rows[0]) {
        if (existing.rows[0].status !== "active") {
          throw new ForbiddenException({ title: "Account suspended" });
        }
        uid = existing.rows[0].id;
      } else if (provider.auto_provision) {
        if (!identity.email) {
          throw new UnauthorizedException({
            title: "IdP did not supply an email address",
          });
        }
        const created = await tx.query<{ id: string }>(
          "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id",
          [identity.email, identity.name ?? ""],
        );
        uid = created.rows[0]!.id;
      } else {
        throw new ForbiddenException({
          title: "No account for this identity",
          detail: "Automatic provisioning is disabled for this provider.",
        });
      }

      await tx.query(
        `INSERT INTO org_members (org_id, user_id, role)
         VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING`,
        [provider.org_id, uid, provider.default_role],
      );
      await tx.query(
        `INSERT INTO sso_identities (provider_id, subject, user_id, last_login_at)
         VALUES ($1, $2, $3, now())`,
        [provider.id, identity.subject, uid],
      );
      return uid;
    });

    this.audit.log({
      orgId: provider.org_id,
      actorType: "user",
      actorId: userId,
      action: "sso.login",
      targetType: "sso_provider",
      targetId: provider.id,
      ip,
    });
    return this.auth.createSession(userId, ip, userAgent);
  }
}

function splitRequest(req: SsoProviderRequest): {
  cfg: OidcConfig | SamlConfig;
  secret?: string;
} {
  if (req.kind === "oidc") {
    return {
      cfg: req.oidc,
      secret: req.client_secret ? req.client_secret : undefined,
    };
  }
  return { cfg: req.saml };
}
