import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Alias,
  CreateAliasRequest,
  UpdateAliasRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface AliasRow {
  id: string;
  domain_id: string;
  source: string;
  destinations: string[];
  enabled: boolean;
  created_at: Date;
  domain_name: string;
  org_id: string;
}

@Injectable()
export class AliasesService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, domainId: string, userId: string): Promise<Alias[]> {
    await this.assertDomain(orgId, domainId, userId);
    const { rows } = await this.db.query<AliasRow>(
      `SELECT a.id, a.domain_id, a.source, a.destinations::text[] AS destinations,
              a.enabled, a.created_at, d.name AS domain_name, d.org_id
       FROM aliases a JOIN domains d ON d.id = a.domain_id
       WHERE a.domain_id = $1 ORDER BY a.source`,
      [domainId],
    );
    return rows.map(toAlias);
  }

  async listOrg(orgId: string, userId: string): Promise<Alias[]> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<AliasRow>(
      `SELECT a.id, a.domain_id, a.source, a.destinations::text[] AS destinations,
              a.enabled, a.created_at, d.name AS domain_name, d.org_id
       FROM aliases a JOIN domains d ON d.id = a.domain_id
       WHERE d.org_id = $1 ORDER BY d.name, a.source`,
      [orgId],
    );
    return rows.map(toAlias);
  }

  async get(orgId: string, id: string, userId: string): Promise<Alias> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<AliasRow>(
      `SELECT a.id, a.domain_id, a.source, a.destinations::text[] AS destinations,
              a.enabled, a.created_at, d.name AS domain_name, d.org_id
       FROM aliases a JOIN domains d ON d.id = a.domain_id
       WHERE a.id = $1 AND d.org_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Alias not found" });
    return toAlias(rows[0]);
  }

  async create(
    principal: SessionPrincipal,
    orgId: string,
    domainId: string,
    req: CreateAliasRequest,
    ip?: string,
  ): Promise<Alias> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.assertDomain(orgId, domainId, principal.userId);
    const inserted = await this.db
      .query<{ id: string }>(
        `INSERT INTO aliases (domain_id, source, destinations, enabled)
         VALUES ($1, $2, $3, COALESCE($4, true)) RETURNING id`,
        [domainId, req.source.toLowerCase(), req.destinations, req.enabled ?? null],
      )
      .catch((err: Error & { code?: string }) => {
        if (err.code === "23505") {
          throw new ConflictException({ title: "Alias already exists" });
        }
        throw err;
      });
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "alias.create",
      targetType: "alias",
      targetId: inserted.rows[0]!.id,
      ip,
      meta: { source: req.source, destinations: req.destinations },
    });
    return this.get(orgId, inserted.rows[0]!.id, principal.userId);
  }

  async update(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    req: UpdateAliasRequest,
    ip?: string,
  ): Promise<Alias> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, id, principal.userId);
    const sets: string[] = ["updated_at = now()"];
    const values: unknown[] = [id];
    if (req.destinations !== undefined) {
      values.push(req.destinations);
      sets.push(`destinations = $${values.length}`);
    }
    if (req.enabled !== undefined) {
      values.push(req.enabled);
      sets.push(`enabled = $${values.length}`);
    }
    await this.db.query(
      `UPDATE aliases SET ${sets.join(", ")} WHERE id = $1`,
      values,
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "alias.update",
      targetType: "alias",
      targetId: id,
      ip,
      meta: req,
    });
    return this.get(orgId, id, principal.userId);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    id: string,
    ip?: string,
  ): Promise<void> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.get(orgId, id, principal.userId);
    await this.db.query("DELETE FROM aliases WHERE id = $1", [id]);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "alias.delete",
      targetType: "alias",
      targetId: id,
      ip,
    });
  }

  private async assertDomain(orgId: string, domainId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{ id: string }>(
      "SELECT id FROM domains WHERE id = $1 AND org_id = $2",
      [domainId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Domain not found" });
  }
}

function toAlias(r: AliasRow): Alias {
  return {
    id: r.id,
    domain_id: r.domain_id,
    domain_name: r.domain_name,
    source: r.source,
    address: `${r.source}@${r.domain_name}`,
    destinations: r.destinations ?? [],
    enabled: r.enabled,
    created_at: r.created_at.toISOString(),
  };
}
