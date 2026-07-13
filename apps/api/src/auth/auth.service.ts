import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { generateSecret, generateURI, verifySync } from "otplib";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
  // Set for mailbox-first webmail sessions: the session is bound to this one
  // mailbox (and its org), which the webmail read path uses for isolation.
  mailboxId?: string | null;
  orgId?: string | null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// Arbitrary constant so concurrent bootstrap requests serialize on the same
// transaction-scoped advisory lock (prevents the count-then-insert race).
const BOOTSTRAP_ADVISORY_LOCK = 0x6a6d_6273; // "jmbs"

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  // Fallback bootstrap token for production deployments that don't set one.
  // Regenerated per process; logged while the instance is unbootstrapped.
  private readonly generatedBootstrapToken = randomBytes(24).toString("base64url");

  constructor(
    private readonly db: Db,
    private readonly audit: AuditService,
    private readonly credStore: WebmailCredentialStore,
    private readonly imapSessions: ImapSessionManager,
    private readonly imapIdle: ImapIdleWatcher,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (config.BOOTSTRAP_TOKEN || !this.bootstrapTokenRequired()) return;
    const { rows } = await this.db.query<{ n: string }>(
      "SELECT count(*) AS n FROM users",
    );
    if (Number(rows[0]?.n ?? 0) === 0) {
      this.logger.warn(
        `No accounts exist yet. First-admin bootstrap token: ${this.generatedBootstrapToken}`,
      );
    }
  }

  private bootstrapTokenRequired(): boolean {
    return config.NODE_ENV === "production" || Boolean(config.BOOTSTRAP_TOKEN);
  }

  private bootstrapTokenMatches(provided: string): boolean {
    const expected = config.BOOTSTRAP_TOKEN ?? this.generatedBootstrapToken;
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  }

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

  async bootstrap(
    req: BootstrapRequest,
    ip?: string,
    userAgent?: string,
    providedToken?: string,
  ) {
    if (
      this.bootstrapTokenRequired() &&
      !this.bootstrapTokenMatches(providedToken ?? "")
    ) {
      throw new UnauthorizedException({
        title: "Invalid bootstrap token",
        detail:
          "Bootstrapping requires the one-time token from the server logs (X-Bootstrap-Token).",
      });
    }

    const passwordHash = await argon2.hash(req.password, ARGON2_OPTS);
    const slug = slugify(req.org_name);

    const { userId, orgId } = await this.db.tx(async (tx) => {
      // Serialize concurrent bootstraps so the count-then-insert below can't
      // race two callers into both becoming the first owner.
      await tx.query("SELECT pg_advisory_xact_lock($1)", [
        BOOTSTRAP_ADVISORY_LOCK,
      ]);
      const { rows } = await tx.query<{ n: string }>(
        "SELECT count(*) AS n FROM users",
      );
      if (Number(rows[0]?.n ?? 1) > 0) {
        throw new ForbiddenException({
          title: "Already bootstrapped",
          detail: "An account already exists; log in instead.",
        });
      }
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
    // No matching console user: fall back to mailbox-first login so an account
    // created in the admin console (a mailbox) can sign into webmail directly
    // with its own address + password.
    if (!user || !ok) {
      return this.mailboxLogin(req, ip, userAgent);
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
      if (!verifySync({ strategy: "totp", secret, token: req.totp_code }).valid) {
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

  /** Mailbox-first login: authenticate against a mailbox's own credentials and
   *  return a session bound to that mailbox, with its IMAP password sealed to
   *  the session so the inbox opens without a second unlock step. */
  private async mailboxLogin(
    req: LoginRequest,
    ip?: string,
    userAgent?: string,
  ) {
    const at = req.email.lastIndexOf("@");
    const localPart = at > 0 ? req.email.slice(0, at).toLowerCase() : "";
    const domain = at > 0 ? req.email.slice(at + 1).toLowerCase() : "";
    const { rows } = await this.db.query<{
      id: string;
      password_hash: string;
      status: string;
      org_id: string;
      address: string;
    }>(
      `SELECT m.id, m.password_hash, m.status, d.org_id,
              (m.local_part || '@' || d.name) AS address
       FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE m.local_part = $1 AND lower(d.name) = $2`,
      [localPart, domain],
    );
    const mb = rows[0];
    const ok = await argon2.verify(mb?.password_hash ?? DUMMY_HASH, req.password);
    if (!mb || !ok) {
      throw new UnauthorizedException({ title: "Invalid credentials" });
    }
    if (mb.status !== "active") {
      throw new ForbiddenException({ title: "Mailbox suspended" });
    }
    // Anchor the session to a per-mailbox identity row so the existing session
    // and audit plumbing (which keys off users.id) is unchanged. This row is
    // never used for password auth — the mailbox hash above is authoritative —
    // so it carries an unusable hash and no org membership.
    // Bind email and name to separate placeholders: reusing one placeholder for
    // both would make Postgres deduce conflicting types for it (email is citext,
    // name is text) and fail with "inconsistent types deduced for parameter $1".
    const shadow = await this.db.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (email) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [mb.address, mb.address, DUMMY_HASH],
    );
    const userId = shadow.rows[0]!.id;
    const session = await this.createSession(userId, ip, userAgent, mb.id);
    await this.credStore.store(session.sessionId, mb.id, mb.address, req.password);
    this.audit.log({
      orgId: mb.org_id,
      actorType: "user",
      actorId: userId,
      action: "auth.login",
      targetType: "mailbox",
      targetId: mb.id,
      ip,
    });
    return { token: session.token, expiresAt: session.expiresAt };
  }

  async createSession(
    userId: string,
    ip?: string,
    userAgent?: string,
    mailboxId?: string | null,
  ) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + config.SESSION_TTL_DAYS * 24 * 3600 * 1000,
    );
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO sessions (user_id, token_hash, ip, user_agent, expires_at, mailbox_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        userId,
        sha256(token),
        ip ?? null,
        userAgent ?? null,
        expiresAt,
        mailboxId ?? null,
      ],
    );
    return { token, expiresAt, sessionId: rows[0]!.id };
  }

  async resolveSession(token: string): Promise<SessionPrincipal | null> {
    const { rows } = await this.db.query<{
      session_id: string;
      user_id: string;
      email: string;
      name: string;
      mailbox_id: string | null;
      mailbox_address: string | null;
      mailbox_org_id: string | null;
    }>(
      `SELECT s.id AS session_id, u.id AS user_id, u.email, u.name,
              s.mailbox_id,
              (mb.local_part || '@' || d.name) AS mailbox_address,
              d.org_id AS mailbox_org_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN mailboxes mb ON mb.id = s.mailbox_id
       LEFT JOIN domains d ON d.id = mb.domain_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
      [sha256(token)],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      email: row.mailbox_address ?? row.email,
      name: row.name,
      sessionId: row.session_id,
      mailboxId: row.mailbox_id,
      orgId: row.mailbox_org_id,
    };
  }

  async me(principal: SessionPrincipal): Promise<Me> {
    // Mailbox-bound session: identity is the mailbox itself, scoped to its one
    // org. It has no console credentials (2FA/passkeys), and the client uses
    // mailbox_id to open the inbox directly.
    if (principal.mailboxId) {
      const org = await this.db.query<{
        id: string;
        name: string;
        slug: string;
      }>(
        `SELECT o.id, o.name, o.slug FROM organizations o WHERE o.id = $1`,
        [principal.orgId],
      );
      return {
        id: principal.mailboxId,
        email: principal.email,
        name: principal.name,
        totp_enabled: false,
        passkey_enabled: false,
        orgs: org.rows.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          role: "member",
        })) as Me["orgs"],
        mailbox_id: principal.mailboxId,
      };
    }
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
      mailbox_id: null,
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
    const secret = generateSecret();
    await this.db.query(
      "UPDATE users SET totp_secret = $1, updated_at = now() WHERE id = $2",
      [seal(secret), principal.userId],
    );
    return {
      secret,
      otpauth_url: generateURI({
        strategy: "totp",
        issuer: "JustMail",
        label: principal.email,
        secret,
      }),
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
    if (!verifySync({ strategy: "totp", secret: open(row.totp_secret), token: code }).valid) {
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

  async passkeyAuthOptions(email?: string): Promise<PasskeyAuthOptionsResponse> {
    // Usernameless (discoverable) login: with no email we emit empty
    // allowCredentials and let the authenticator surface any resident passkey.
    // With an email we scope the prompt to that account's credentials.
    let userId: string | null = null;
    let allow: StoredCredential[] = [];
    if (email) {
      const { rows } = await this.db.query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1 AND status = 'active'",
        [email],
      );
      userId = rows[0]?.id ?? null;
      allow = userId ? await this.loadCredentials(userId) : [];
    }
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
    if (!pending) {
      throw new UnauthorizedException({ title: "Passkey login failed" });
    }
    const credentialId =
      typeof response === "object" && response !== null
        ? (response as { id?: string }).id
        : undefined;
    if (!credentialId) {
      throw new UnauthorizedException({ title: "Passkey login failed" });
    }
    // For a usernameless challenge (no bound user) resolve the account from the
    // resident credential itself; credential_id is globally unique and the
    // signature is still verified against its stored public key below.
    const credRows = await this.db.query<{
      id: string;
      user_id: string;
      public_key: Buffer;
      counter: string;
      transports: string[];
    }>(
      pending.user_id
        ? `SELECT c.id, c.user_id, c.public_key, c.counter, c.transports
           FROM webauthn_credentials c
           WHERE c.user_id = $1 AND c.credential_id = $2`
        : `SELECT c.id, c.user_id, c.public_key, c.counter, c.transports
           FROM webauthn_credentials c
           JOIN users u ON u.id = c.user_id
           WHERE c.credential_id = $1 AND u.status = 'active'`,
      pending.user_id ? [pending.user_id, credentialId] : [credentialId],
    );
    const stored = credRows.rows[0];
    if (!stored) {
      throw new UnauthorizedException({ title: "Passkey login failed" });
    }
    const userId = pending.user_id ?? stored.user_id;
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
      actorId: userId,
      action: "auth.passkey.login",
      targetType: "user",
      targetId: userId,
      ip,
    });
    return this.createSession(userId, ip, userAgent);
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
