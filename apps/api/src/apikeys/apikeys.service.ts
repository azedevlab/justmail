import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreatedApiKey,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface KeyRow {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface ApiKeyPrincipal {
  keyId: string;
  orgId: string;
  scopes: string[];
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, userId: string): Promise<ApiKey[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<KeyRow>(
      `SELECT id, org_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at
       FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return rows.map(toApiKey);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    req: CreateApiKeyRequest,
    ip?: string,
  ): Promise<CreatedApiKey> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const token = `jm_${randomBytes(28).toString("base64url")}`;
    const prefix = token.slice(0, 10);
    const hash = sha256(token);
    const { rows } = await this.db.query<KeyRow>(
      `INSERT INTO api_keys (org_id, name, key_prefix, key_hash, scopes, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, org_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at`,
      [
        orgId,
        req.name,
        prefix,
        hash,
        req.scopes ?? [],
        req.expires_at ?? null,
        principal.userId,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "apikey.create",
      targetType: "api_key",
      targetId: rows[0]!.id,
      ip,
      meta: { name: req.name, scopes: req.scopes },
    });
    return { ...toApiKey(rows[0]!), token };
  }

  async revoke(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rowCount } = await this.db.query(
      "UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL",
      [id, orgId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Key not found" });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "apikey.revoke",
      targetType: "api_key",
      targetId: id,
      ip,
    });
  }

  /** Resolve a Bearer token → principal; timing-safe compare via digest. */
  async resolve(token: string): Promise<ApiKeyPrincipal> {
    const hash = sha256(token);
    const { rows } = await this.db.query<{
      id: string;
      org_id: string;
      scopes: string[];
      revoked_at: Date | null;
      expires_at: Date | null;
      key_hash: string;
    }>(
      `SELECT id, org_id, scopes, revoked_at, expires_at, key_hash
       FROM api_keys WHERE key_hash = $1`,
      [hash],
    );
    const key = rows[0];
    if (!key || !timingSafeEqual(Buffer.from(key.key_hash), Buffer.from(hash))) {
      throw new UnauthorizedException({ title: "Invalid API key" });
    }
    if (key.revoked_at) throw new UnauthorizedException({ title: "API key revoked" });
    if (key.expires_at && key.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException({ title: "API key expired" });
    }
    // Touch last_used_at without blocking the request.
    void this.db.query(
      "UPDATE api_keys SET last_used_at = now() WHERE id = $1",
      [key.id],
    );
    return { keyId: key.id, orgId: key.org_id, scopes: key.scopes };
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function toApiKey(r: KeyRow): ApiKey {
  return {
    id: r.id,
    name: r.name,
    key_prefix: r.key_prefix,
    scopes: r.scopes ?? [],
    last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
    expires_at: r.expires_at ? r.expires_at.toISOString() : null,
    revoked_at: r.revoked_at ? r.revoked_at.toISOString() : null,
    created_at: r.created_at.toISOString(),
  };
}
