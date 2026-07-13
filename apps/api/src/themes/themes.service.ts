import { Injectable, NotFoundException } from "@nestjs/common";
import type { Theme, ThemeTokens, UpsertThemeRequest } from "@justmail/contracts";
import { assertValidTokens } from "@justmail/theme-engine";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

interface ThemeRow {
  id: string;
  org_id: string | null;
  domain_id: string | null;
  name: string;
  tokens: ThemeTokens;
  css_extra: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ThemesService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  /** The org's default theme (domain_id IS NULL), or null when none is saved. */
  async get(orgId: string, userId: string): Promise<Theme | null> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<ThemeRow>(
      `SELECT id, org_id, domain_id, name, tokens, css_extra, created_at, updated_at
       FROM themes WHERE org_id = $1 AND domain_id IS NULL`,
      [orgId],
    );
    return rows[0] ? toTheme(rows[0]) : null;
  }

  async upsert(
    principal: SessionPrincipal,
    orgId: string,
    req: UpsertThemeRequest,
    ip?: string,
  ): Promise<Theme> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    assertValidTokens(req.tokens);

    const domainId = req.domain_id ?? null;
    if (domainId) {
      const { rows } = await this.db.query(
        "SELECT 1 FROM domains WHERE id = $1 AND org_id = $2",
        [domainId, orgId],
      );
      if (!rows[0]) throw new NotFoundException({ title: "Domain not found" });
    }

    const existing = await this.db.query<{ id: string }>(
      domainId
        ? "SELECT id FROM themes WHERE org_id = $1 AND domain_id = $2"
        : "SELECT id FROM themes WHERE org_id = $1 AND domain_id IS NULL",
      domainId ? [orgId, domainId] : [orgId],
    );

    let saved: ThemeRow;
    if (existing.rows[0]) {
      const { rows } = await this.db.query<ThemeRow>(
        `UPDATE themes SET name = $2, tokens = $3, css_extra = $4, updated_at = now()
         WHERE id = $1
         RETURNING id, org_id, domain_id, name, tokens, css_extra, created_at, updated_at`,
        [existing.rows[0].id, req.name, req.tokens, req.css_extra],
      );
      saved = rows[0]!;
    } else {
      const { rows } = await this.db.query<ThemeRow>(
        `INSERT INTO themes (org_id, domain_id, name, tokens, css_extra)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, org_id, domain_id, name, tokens, css_extra, created_at, updated_at`,
        [orgId, domainId, req.name, req.tokens, req.css_extra],
      );
      saved = rows[0]!;
    }

    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "theme.upsert",
      targetType: "theme",
      targetId: saved.id,
      ip,
      meta: { name: req.name, domain_id: domainId },
    });
    return toTheme(saved);
  }
}

function toTheme(r: ThemeRow): Theme {
  return {
    id: r.id,
    org_id: r.org_id,
    domain_id: r.domain_id,
    name: r.name,
    tokens: r.tokens,
    css_extra: r.css_extra,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}
