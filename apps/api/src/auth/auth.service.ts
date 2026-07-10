import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { createHash, createHmac, randomBytes } from "node:crypto";
import type {
  BootstrapRequest,
  LoginRequest,
  Me,
  PasskeyAuthOptionsResponse,
  PasskeyInfo,
  SessionInfo,
  TwoFaSetupResponse,
} from "@justmail/contracts";
import { config } from "../config";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { open, seal } from "../common/secretbox";
import { WebmailCredentialStore } from "../webmail/credential.store";
import { ImapSessionManager } from "../webmail/imap-session.manager";
import { ImapIdleWatcher } from "../webmail/imap-idle.watcher";
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration,
  type StoredCredential,
} from "./webauthn";

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// Verified against when the email doesn't exist, so response timing doesn't
// reveal which addresses have accounts.
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$H5up0OeRUAaDs8VN2u9tLj6PdBXPUmC6d0hLtBbBmxg";

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  status: string;
}

export interface SessionPrincipal {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly credStore: WebmailCredentialStore,
    private readonly imapSessions: ImapSessionManager,
    private readonly imapIdle: ImapIdleWatcher,
  ) {}

  async status() {
    const { rows } = await this.db.query<{ n: string }>(
      "SELECT count(*) AS n FROM users",
    );
    // SSO providers are discovered per email domain (not advertised globally) to
    // avoid leaking every tenant's IdP, so the public list stays empty here.
    return {
      bootstrapped: Number(rows[0]?.n ?? 0) > 0,
      passkeys_supported: true,
      sso_providers: [] as { id: string; name: string; kind: "oidc" | "saml" }[],
    };
  }

  async bootstrap(req: BootstrapRequest, ip?: string, userAgent?: string) {
    const { rows } = await this.db.query<{ n: string }>(
      "SELECT count(*) AS n FROM users",
    );
    if (Number(rows[0]?.n ?? 1) > 0) {
      throw new ForbiddenException({
        title: "Already bootstrapped",
        detail: "An account already exists; log in instead.",
      });
    }

    const passwordHash = await argon2.hash(req.password, ARGON2_OPTS);
    const slug = slugify(req.org_name);

    const { userId, orgId } = await this.db.tx(async (tx) => {
      const org = await tx.query<{ id: string }>(
        "INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id",
        [req.org_name, slug],
      );
      const user = await tx.query<{ id: string }>(
        "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [req.email, req.name, passwordHash],
      );
      await tx.query(
        "INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')",
        [org.rows[0]!.id, user.rows[0]!.id],
      );
      return { userId: user.rows[0]!.id, orgId: org.rows[0]!.id };
    });

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: userId,
      action: "auth.bootstrap",
      targetType: "user",
      targetId: userId,
      ip,
    });

    return this.createSession(userId, ip, userAgent);
  }

  async login(req: LoginRequest, ip?: string, userAgent?: string) {
    const { rows } = await this.db.query<UserRow>(
      "SELECT id, email, name, password_hash, totp_secret, totp_enabled, status FROM users WHERE email = $1",
      [req.email],
    );
    const user = rows[0];

    const ok = await argon2.verify(
      user?.password_hash ?? DUMMY_HASH,
      req.password,
    );
    if (!user || !ok) {
      throw new UnauthorizedException({
        title: "Invalid credentials",
      });
    }
    if (user.status !== "active") {
      throw new ForbiddenException({ title: "Account suspended" });
    }

    if (user.totp_enabled) {
      if (!req.totp_code) {
        throw new UnauthorizedException({
          type: "https://justmail.dev/errors/totp-required",
          title: "Two-factor code required",
        });
      }
      const secret = open(user.totp_secret!);
      if (!authenticator.check(req.totp_code, secret)) {
        throw new UnauthorizedException({ title: "Invalid two-factor code" });
      }
    }

    this.audit.log({
      actorType: "user",
      actorId: user.id,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      ip,
    });

    return this.createSession(user.id, ip, userAgent);
  }

  async createSession(userId: string, ip?: string, userAgent?: string) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + config.SESSION_TTL_DAYS * 24 * 3600 * 1000,
    );
    await this.db.query(
      `INSERT INTO sessions (user_id, token_hash, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, sha256(token), ip ?? null, userAgent ?? null, expiresAt],
    );
    return { token, expiresAt };
  }

  async resolveSession(token: string): Promise<SessionPrincipal | null> {
    const { rows } = await this.db.query<{
      session_id: string;
      user_id: string;
      email: string;
      name: string;
    }>(
      `SELECT s.id AS session_id, u.id AS user_id, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
      [sha256(token)],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      email: row.email,
      name: row.name,
      sessionId: row.session_id,
    };
  }

  async me(principal: SessionPrincipal): Promise<Me> {
    const [user, orgs, passkeys] = await Promise.all([
      this.db.query<{ totp_enabled: boolean }>(
        "SELECT totp_enabled FROM users WHERE id = $1",
        [principal.userId],
      ),
      this.db.query<{ id: string; name: string; slug: string; role: string }>(
        `SELECT o.id, o.name, o.slug, m.role
         FROM org_members m JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = $1 ORDER BY o.created_at`,
        [principal.userId],
      ),
      this.db.query<{ n: string }>(
        "SELECT count(*) AS n FROM webauthn_credentials WHERE user_id = $1",
        [principal.userId],
      ),
    ]);
    return {
      id: principal.userId,
      email: principal.email,
      name: principal.name,
      totp_enabled: user.rows[0]?.totp_enabled ?? false,
      passkey_enabled: Number(passkeys.rows[0]?.n ?? 0) > 0,
      orgs: orgs.rows as Me["orgs"],
    };
  }

  /** Issue a short-lived signed ticket the client uses to authenticate on
   *  the WebSocket handshake. HMAC-signed with the platform master key. */
  async wsTicket(principal: SessionPrincipal): Promise<{ ticket: string; expires_at: string }> {
    const { rows } = await this.db.query<{ org_id: string }>(
      "SELECT org_id FROM org_members WHERE user_id = $1",
      [principal.userId],
    );
    const exp = Math.floor(Date.now() / 1000) + 60;
    const payload = {
      sessionId: principal.sessionId,
      userId: principal.userId,
      orgIds: rows.map((r) => r.org_id),
      exp,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", config.ENCRYPTION_KEY)
      .update(payloadB64)
      .digest("base64url");
    return {
      ticket: `${payloadB64}.${sig}`,
      expires_at: new Date(exp * 1000).toISOString(),
    };
  }

  async logout(principal: SessionPrincipal, ip?: string): Promise<void> {
    await this.db.query("DELETE FROM sessions WHERE id = $1", [
      principal.sessionId,
    ]);
    await this.credStore.purgeSession(principal.sessionId);
    await this.imapSessions.purgeSession(principal.sessionId);
    await this.imapIdle.purgeSession(principal.sessionId);
    this.audit.log({
      actorType: "user",
      actorId: principal.userId,
      action: "auth.logout",
      ip,
    });
  }

  async listSessions(principal: SessionPrincipal): Promise<SessionInfo[]> {
    const { rows } = await this.db.query<{
      id: string;
      ip: string | null;
      user_agent: string | null;
      created_at: Date;
      expires_at: Date;
    }>(
      `SELECT id, ip, user_agent, created_at, expires_at
       FROM sessions WHERE user_id = $1 AND expires_at > now()
       ORDER BY created_at DESC`,
      [principal.userId],
    );
    return rows.map((r) => ({
      id: r.id,
      ip: r.ip,
      user_agent: r.user_agent,
      device_fingerprint: null,
      created_at: r.created_at.toISOString(),
      expires_at: r.expires_at.toISOString(),
      last_seen_at: r.created_at.toISOString(),
      current: r.id === principal.sessionId,
    }));
  }

  async revokeSession(principal: SessionPrincipal, sessionId: string, ip?: string) {
    const { rowCount } = await this.db.query(
      "DELETE FROM sessions WHERE id = $1 AND user_id = $2",
      [sessionId, principal.userId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Session not found" });
    await this.credStore.purgeSession(sessionId);
    await this.imapSessions.purgeSession(sessionId);
    await this.imapIdle.purgeSession(sessionId);
    this.audit.log({
      actorType: "user",
      actorId: principal.userId,
      action: "auth.session.revoke",
      targetType: "session",
      targetId: sessionId,
      ip,
    });
  }

  async setupTwoFa(principal: SessionPrincipal): Promise<TwoFaSetupResponse> {
    const { rows } = await this.db.query<{ totp_enabled: boolean }>(
      "SELECT totp_enabled FROM users WHERE id = $1",
      [principal.userId],
    );
    if (rows[0]?.totp_enabled) {
      throw new ConflictException({ title: "Two-factor already enabled" });
    }
    const secret = authenticator.generateSecret();
    await this.db.query(
      "UPDATE users SET totp_secret = $1, updated_at = now() WHERE id = $2",
      [seal(secret), principal.userId],
    );
    return {
      secret,
      otpauth_url: authenticator.keyuri(principal.email, "JustMail", secret),
    };
  }

  async verifyTwoFa(principal: SessionPrincipal, code: string, ip?: string) {
    const { rows } = await this.db.query<{
      totp_secret: string | null;
      totp_enabled: boolean;
    }>("SELECT totp_secret, totp_enabled FROM users WHERE id = $1", [
      principal.userId,
    ]);
    const row = rows[0];
    if (!row?.totp_secret || row.totp_enabled) {
      throw new ConflictException({
        title: "Two-factor setup not in progress",
      });
    }
    if (!authenticator.check(code, open(row.totp_secret))) {
      throw new UnauthorizedException({ title: "Invalid two-factor code" });
    }
    await this.db.query(
      "UPDATE users SET totp_enabled = true, updated_at = now() WHERE id = $1",
      [principal.userId],
    );
    this.audit.log({
      actorType: "user",
      actorId: principal.userId,
      action: "auth.2fa.enable",
      ip,
    });
  }

  async disableTwoFa(principal: SessionPrincipal, password: string, ip?: string) {
    const { rows } = await this.db.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [principal.userId],
    );
    if (!rows[0] || !(await argon2.verify(rows[0].password_hash, password))) {
      throw new UnauthorizedException({ title: "Invalid password" });
    }
    await this.db.query(
      "UPDATE users SET totp_enabled = false, totp_secret = NULL, updated_at = now() WHERE id = $1",
      [principal.userId],
    );
    this.audit.log({
      actorType: "user",
      actorId: principal.userId,
      action: "auth.2fa.disable",
      ip,
    });
  }

  private async loadCredentials(userId: string): Promise<StoredCredential[]> {
    const { rows } = await this.db.query<{
      credential_id: string;
      public_key: Buffer;
      counter: string;
      transports: string[];
    }>(
      "SELECT credential_id, public_key, counter, transports FROM webauthn_credentials WHERE user_id = $1",
      [userId],
    );
    return rows.map((r) => ({
      credentialId: r.credential_id,
      publicKey: r.public_key,
      counter: Number(r.counter),
      transports: r.transports,
    }));
  }

  private async storeChallenge(
    kind: "register" | "auth",
    userId: string | null,
    challenge: string,
  ): Promise<string> {
    const expires = new Date(
      Date.now() + config.WEBAUTHN_CHALLENGE_TTL_SECONDS * 1000,
    );
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO webauthn_challenges (user_id, kind, challenge, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, kind, challenge, expires],
    );
    return rows[0]!.id;
  }

  async passkeyRegisterOptions(principal: SessionPrincipal) {
    const existing = await this.loadCredentials(principal.userId);
    const options = await registrationOptions({
      userId: principal.userId,
      userName: principal.email,
      userDisplayName: principal.name || principal.email,
      existing,
    });
    await this.storeChallenge("register", principal.userId, options.challenge);
    return options;
  }

  async passkeyRegisterVerify(
    principal: SessionPrincipal,
    name: string,
    response: unknown,
    ip?: string,
  ): Promise<PasskeyInfo> {
    const { rows } = await this.db.query<{ id: string; challenge: string }>(
      `DELETE FROM webauthn_challenges
       WHERE id = (
         SELECT id FROM webauthn_challenges
         WHERE user_id = $1 AND kind = 'register' AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1
       ) RETURNING id, challenge`,
      [principal.userId],
    );
    const pending = rows[0];
    if (!pending) {
      throw new UnauthorizedException({ title: "Passkey challenge expired" });
    }
    const result = await verifyRegistration({
      response,
      expectedChallenge: pending.challenge,
    });
    if (!result.verified || !result.registrationInfo) {
      throw new UnauthorizedException({ title: "Passkey registration failed" });
    }
    const info = result.registrationInfo;
    const cred = info.credential;
    const inserted = await this.db.query<{
      id: string;
      name: string;
      device_type: string | null;
      backed_up: boolean;
      created_at: Date;
      last_used_at: Date | null;
    }>(
      `INSERT INTO webauthn_credentials
         (user_id, credential_id, public_key, counter, transports, device_type, backed_up, name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, device_type, backed_up, created_at, last_used_at`,
      [
        principal.userId,
        cred.id,
        Buffer.from(cred.publicKey),
        cred.counter,
        cred.transports ?? [],
        info.credentialDeviceType ?? null,
        info.credentialBackedUp ?? false,
        name,
      ],
    );
    this.audit.log({
      actorType: "user",
      actorId: principal.userId,
      action: "auth.passkey.register",
      targetType: "passkey",
      targetId: inserted.rows[0]!.id,
      ip,
    });
    const r = inserted.rows[0]!;
    return {
      id: r.id,
      name: r.name,
      device_type: r.device_type,
      backed_up: r.backed_up,
      created_at: r.created_at.toISOString(),
      last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
    };
  }

  async listPasskeys(principal: SessionPrincipal): Promise<PasskeyInfo[]> {
    const { rows } = await this.db.query<{
      id: string;
      name: string;
      device_type: string | null;
      backed_up: boolean;
      created_at: Date;
      last_used_at: Date | null;
    }>(
      `SELECT id, name, device_type, backed_up, created_at, last_used_at
       FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC`,
      [principal.userId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      device_type: r.device_type,
      backed_up: r.backed_up,
      created_at: r.created_at.toISOString(),
      last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
    }));
  }

  async removePasskey(
    principal: SessionPrincipal,
    id: string,
    ip?: string,
  ): Promise<void> {
    const { rowCount } = await this.db.query(
      "DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2",
      [id, principal.userId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Passkey not found" });
    this.audit.log({
      actorType: "user",
      actorId: principal.userId,
      action: "auth.passkey.remove",
      targetType: "passkey",
      targetId: id,
      ip,
    });
  }

  async passkeyAuthOptions(email: string): Promise<PasskeyAuthOptionsResponse> {
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 AND status = 'active'",
      [email],
    );
    const userId = rows[0]?.id ?? null;
    const allow = userId ? await this.loadCredentials(userId) : [];
    const options = await authenticationOptions({ allow });
    // Store the challenge even for unknown accounts so the response shape and
    // timing don't reveal whether the email exists or has passkeys.
    const challengeId = await this.storeChallenge(
      "auth",
      userId,
      options.challenge,
    );
    return { challenge_id: challengeId, options };
  }

  async passkeyAuthVerify(
    challengeId: string,
    response: unknown,
    ip?: string,
    userAgent?: string,
  ) {
    const { rows } = await this.db.query<{
      user_id: string | null;
      challenge: string;
    }>(
      `DELETE FROM webauthn_challenges
       WHERE id = $1 AND kind = 'auth' AND expires_at > now()
       RETURNING user_id, challenge`,
      [challengeId],
    );
    const pending = rows[0];
    if (!pending || !pending.user_id) {
      throw new UnauthorizedException({ title: "Passkey login failed" });
    }
    const credentialId =
      typeof response === "object" && response !== null
        ? (response as { id?: string }).id
        : undefined;
    if (!credentialId) {
      throw new UnauthorizedException({ title: "Passkey login failed" });
    }
    const credRows = await this.db.query<{
      id: string;
      public_key: Buffer;
      counter: string;
      transports: string[];
    }>(
      `SELECT id, public_key, counter, transports FROM webauthn_credentials
       WHERE user_id = $1 AND credential_id = $2`,
      [pending.user_id, credentialId],
    );
    const stored = credRows.rows[0];
    if (!stored) {
      throw new UnauthorizedException({ title: "Passkey login failed" });
    }
    const result = await verifyAuthentication({
      response,
      expectedChallenge: pending.challenge,
      credential: {
        credentialId,
        publicKey: stored.public_key,
        counter: Number(stored.counter),
        transports: stored.transports,
      },
    });
    if (!result.verified) {
      throw new UnauthorizedException({ title: "Passkey login failed" });
    }
    await this.db.query(
      "UPDATE webauthn_credentials SET counter = $1, last_used_at = now() WHERE id = $2",
      [result.authenticationInfo.newCounter, stored.id],
    );
    this.audit.log({
      actorType: "user",
      actorId: pending.user_id,
      action: "auth.passkey.login",
      targetType: "user",
      targetId: pending.user_id,
      ip,
    });
    return this.createSession(pending.user_id, ip, userAgent);
  }
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `org-${randomBytes(4).toString("hex")}`;
}
