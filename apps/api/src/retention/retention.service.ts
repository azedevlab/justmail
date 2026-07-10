import { Injectable, Logger } from "@nestjs/common";
import type {
  RetentionPolicy,
  UpdateRetentionRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";
import { MasterImap } from "./master-imap";
import { LegalHoldService } from "./legal-hold.service";

interface PolicyRow {
  org_id: string;
  enabled: boolean;
  delete_after_days: number | null;
  folders: string[];
  updated_at: Date;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly master: MasterImap,
    private readonly holds: LegalHoldService,
  ) {}

  async getPolicy(orgId: string, userId: string): Promise<RetentionPolicy> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<PolicyRow>(
      `INSERT INTO retention_policies (org_id) VALUES ($1)
       ON CONFLICT (org_id) DO UPDATE SET updated_at = retention_policies.updated_at
       RETURNING org_id, enabled, delete_after_days, folders, updated_at`,
      [orgId],
    );
    return this.toPolicy(rows[0]!);
  }

  async updatePolicy(
    principal: SessionPrincipal,
    orgId: string,
    req: UpdateRetentionRequest,
    ip?: string,
  ): Promise<RetentionPolicy> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const sets: string[] = ["updated_at = now()", "updated_by = $2"];
    const values: unknown[] = [orgId, principal.userId];
    const push = (col: string, val: unknown) => {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    };
    if (req.enabled !== undefined) push("enabled", req.enabled);
    if (req.delete_after_days !== undefined)
      push("delete_after_days", req.delete_after_days);
    if (req.folders !== undefined) push("folders", req.folders);

    const { rows } = await this.db.query<PolicyRow>(
      `INSERT INTO retention_policies (org_id, updated_by)
       VALUES ($1, $2)
       ON CONFLICT (org_id) DO UPDATE SET ${sets.join(", ")}
       RETURNING org_id, enabled, delete_after_days, folders, updated_at`,
      values,
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "retention.policy.update",
      targetType: "organization",
      targetId: orgId,
      ip,
      meta: req,
    });
    return this.toPolicy(rows[0]!);
  }

  /** Worker tick: prune expired mail across all orgs with an active policy. */
  async runDuePruning(): Promise<void> {
    if (!this.master.configured) return;
    const { rows } = await this.db.query<PolicyRow>(
      `SELECT org_id, enabled, delete_after_days, folders, updated_at
       FROM retention_policies
       WHERE enabled = true AND delete_after_days IS NOT NULL AND delete_after_days > 0`,
    );
    for (const policy of rows) {
      try {
        await this.pruneOrg(policy);
      } catch (err) {
        this.logger.warn(
          `retention prune failed for org ${policy.org_id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async pruneOrg(policy: PolicyRow): Promise<void> {
    if (policy.folders.length === 0) return;
    const held = await this.holds.heldMailboxIds(policy.org_id);
    if (held.orgWide) return;

    const { rows: boxes } = await this.db.query<{ id: string; address: string }>(
      `SELECT m.id, m.local_part || '@' || d.name AS address
       FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE d.org_id = $1 AND m.status = 'active'`,
      [policy.org_id],
    );
    const cutoff = new Date(
      Date.now() - policy.delete_after_days! * 86_400_000,
    );

    for (const box of boxes) {
      if (held.ids.has(box.id)) continue;
      try {
        await this.pruneMailbox(box.address, policy.folders, cutoff);
      } catch (err) {
        this.logger.warn(
          `retention prune failed for ${box.address}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async pruneMailbox(
    address: string,
    folders: string[],
    cutoff: Date,
  ): Promise<void> {
    await this.master.withClient(address, async (client) => {
      for (const folder of folders) {
        const lock = await client
          .getMailboxLock(folder)
          .catch(() => null);
        if (!lock) continue; // folder absent for this mailbox
        try {
          const uids = await client.search({ before: cutoff }, { uid: true });
          if (uids && uids.length) {
            await client.messageDelete(uids, { uid: true });
          }
        } finally {
          lock.release();
        }
      }
    });
  }

  private toPolicy(r: PolicyRow): RetentionPolicy {
    return {
      org_id: r.org_id,
      enabled: r.enabled,
      delete_after_days: r.delete_after_days,
      folders: r.folders ?? [],
      master_configured: this.master.configured,
      updated_at: r.updated_at.toISOString(),
    };
  }
}
