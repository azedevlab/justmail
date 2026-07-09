import { Injectable } from "@nestjs/common";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";

@Injectable()
export class CertsService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
  ) {}

  async list(orgId: string, userId: string) {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query(
      `SELECT id, kind, status, domains, not_before, not_after, last_error,
              storage_path, created_at, updated_at
       FROM certificates WHERE org_id = $1 OR org_id IS NULL
       ORDER BY created_at DESC`,
      [orgId],
    );
    return rows.map((r) => ({
      ...r,
      not_before: r.not_before ? (r.not_before as Date).toISOString() : null,
      not_after: r.not_after ? (r.not_after as Date).toISOString() : null,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }));
  }
}
