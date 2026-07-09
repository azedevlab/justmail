import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { generateKeyPairSync } from "node:crypto";
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { seal, open } from "../common/secretbox";
import type { SessionPrincipal } from "../auth/auth.service";

interface DkimRow {
  id: string;
  domain_id: string;
  selector: string;
  algorithm: "rsa2048" | "ed25519";
  private_key_enc: string;
  public_key: string;
  status: "pending" | "published" | "active" | "retired";
  created_at: Date;
  activated_at: Date | null;
  retired_at: Date | null;
  domain_name: string;
}

@Injectable()
export class DkimService {
  private readonly logger = new Logger(DkimService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async listForDomain(orgId: string, domainId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<DkimRow>(
      `SELECT k.*, d.name AS domain_name
       FROM dkim_keys k JOIN domains d ON d.id = k.domain_id
       WHERE k.domain_id = $1 AND d.org_id = $2 ORDER BY k.created_at DESC`,
      [domainId, orgId],
    );
    return rows.map(toKey);
  }

  async generate(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    algorithm: "rsa2048" | "ed25519" = "rsa2048",
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rows: dr } = await this.db.query<{ name: string }>(
      "SELECT name FROM domains WHERE id = $1 AND org_id = $2",
      [domainId, orgId],
    );
    if (!dr[0]) throw new NotFoundException({ title: "Domain not found" });
    const domainName = dr[0].name;

    const selector = nextSelector();
    const { publicKeyPem, publicKeyB64, privateKeyPem } = generate(algorithm);
    const enc = seal(privateKeyPem);
    const dnsContent = dnsRecordContent(algorithm, publicKeyB64);

    await this.db
      .tx(async (tx) => {
        await tx.query(
          `INSERT INTO dkim_keys (domain_id, selector, algorithm, private_key_enc, public_key, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [domainId, selector, algorithm, enc, publicKeyPem],
        );
        await tx.query(
          `INSERT INTO dns_records (domain_id, purpose, type, name, content, ttl)
           VALUES ($1, 'dkim', 'TXT', $2, $3, 3600)
           ON CONFLICT (domain_id, purpose, name, type) DO UPDATE
             SET content = EXCLUDED.content, updated_at = now()`,
          [domainId, `${selector}._domainkey.${domainName}`, dnsContent],
        );
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === "23505") {
          throw new ConflictException({ title: "Selector already exists" });
        }
        throw err;
      });

    await this.writeKeyFile(domainName, selector, privateKeyPem);
    await this.rebuildSelectorMap();

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "dkim.generate",
      targetType: "domain",
      targetId: domainId,
      ip,
      meta: { selector, algorithm },
    });

    return { selector, algorithm, dns_content: dnsContent };
  }

  async activate(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    keyId: string,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.db.tx(async (tx) => {
      const { rowCount } = await tx.query(
        `UPDATE dkim_keys SET status = 'active', activated_at = now()
         WHERE id = $1 AND domain_id = $2`,
        [keyId, domainId],
      );
      if (!rowCount) throw new NotFoundException({ title: "Key not found" });
      await tx.query(
        `UPDATE dkim_keys SET status = 'retired', retired_at = now()
         WHERE domain_id = $1 AND id <> $2 AND status = 'active'`,
        [domainId, keyId],
      );
    });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "dkim.activate",
      targetType: "dkim_key",
      targetId: keyId,
      ip,
    });
  }

  async retire(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    keyId: string,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const { rows } = await this.db.query<{ domain_name: string; selector: string }>(
      `SELECT d.name AS domain_name, k.selector
       FROM dkim_keys k JOIN domains d ON d.id = k.domain_id
       WHERE k.id = $1 AND k.domain_id = $2 AND d.org_id = $3`,
      [keyId, domainId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Key not found" });
    await this.db.query(
      `UPDATE dkim_keys SET status = 'retired', retired_at = now() WHERE id = $1`,
      [keyId],
    );
    await this.deleteKeyFile(rows[0].domain_name, rows[0].selector);
    await this.rebuildSelectorMap();
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "dkim.retire",
      targetType: "dkim_key",
      targetId: keyId,
      ip,
    });
  }

  /** Rewrites all key files + selectors.map from DB. Used on startup + rotations. */
  async syncKeysToDisk(): Promise<{ count: number }> {
    const { rows } = await this.db.query<{
      domain_name: string;
      selector: string;
      private_key_enc: string;
      is_active: boolean;
    }>(
      `SELECT d.name AS domain_name, k.selector, k.private_key_enc,
              (k.status = 'active') AS is_active
       FROM dkim_keys k JOIN domains d ON d.id = k.domain_id
       WHERE k.status IN ('pending','published','active')`,
    );
    for (const r of rows) {
      try {
        await this.writeKeyFile(r.domain_name, r.selector, open(r.private_key_enc));
      } catch (err) {
        this.logger.warn(`skip ${r.domain_name}.${r.selector}: ${(err as Error).message}`);
      }
    }
    await this.rebuildSelectorMap();
    return { count: rows.length };
  }

  private async writeKeyFile(domain: string, selector: string, pem: string) {
    await mkdir(config.DKIM_DIR, { recursive: true });
    const p = path.join(config.DKIM_DIR, `${domain}.${selector}.key`);
    await writeFile(p, pem, { encoding: "utf8" });
    await chmod(p, 0o640);
  }

  private async deleteKeyFile(domain: string, selector: string) {
    const p = path.join(config.DKIM_DIR, `${domain}.${selector}.key`);
    await unlink(p).catch(() => undefined);
  }

  /** Rebuilds selectors.map: one `<domain> <selector>` line per active key. */
  private async rebuildSelectorMap() {
    const { rows } = await this.db.query<{ domain_name: string; selector: string }>(
      `SELECT d.name AS domain_name, k.selector
       FROM dkim_keys k JOIN domains d ON d.id = k.domain_id
       WHERE k.status = 'active' ORDER BY d.name`,
    );
    const contents = rows.map((r) => `${r.domain_name} ${r.selector}`).join("\n") + "\n";
    await mkdir(config.DKIM_DIR, { recursive: true });
    await writeFile(path.join(config.DKIM_DIR, "selectors.map"), contents, "utf8");
  }
}

// yyyymm selector — rotation-friendly + human-readable
function nextSelector(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `jm${yyyy}${mm}`;
}

interface Generated {
  publicKeyPem: string;
  publicKeyB64: string;
  privateKeyPem: string;
}

function generate(algorithm: "rsa2048" | "ed25519"): Generated {
  if (algorithm === "ed25519") {
    const kp = generateKeyPairSync("ed25519");
    const publicKeyPem = kp.publicKey.export({ type: "spki", format: "pem" }).toString();
    const privateKeyPem = kp.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    const publicKeyB64 = pemToDkimB64(publicKeyPem);
    return { publicKeyPem, publicKeyB64, privateKeyPem };
  }
  const kp = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKeyPem = kp.publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = kp.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  const publicKeyB64 = pemToDkimB64(publicKeyPem);
  return { publicKeyPem, publicKeyB64, privateKeyPem };
}

// Strip PEM header/footer + newlines → the SPKI-encoded key that DKIM records use.
function pemToDkimB64(pem: string): string {
  return pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
}

function dnsRecordContent(algorithm: "rsa2048" | "ed25519", pk: string): string {
  const k = algorithm === "ed25519" ? "ed25519" : "rsa";
  return `v=DKIM1; k=${k}; p=${pk}`;
}

function toKey(r: DkimRow) {
  return {
    id: r.id,
    domain_id: r.domain_id,
    selector: r.selector,
    algorithm: r.algorithm,
    public_key: r.public_key,
    status: r.status,
    created_at: r.created_at.toISOString(),
    activated_at: r.activated_at?.toISOString() ?? null,
    retired_at: r.retired_at?.toISOString() ?? null,
    domain_name: r.domain_name,
  };
}
