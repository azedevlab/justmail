import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  SieveAction,
  SieveCondition,
  SieveMatch,
  SieveRule,
  SieveRuleRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuditService } from "../audit/audit.service";
import { REDIS, type RedisClient } from "../common/redis.module";
import { config } from "../config";
import type { SessionPrincipal } from "../auth/auth.service";
import { WebmailCredentialStore } from "./credential.store";
import { ManageSieveClient } from "./managesieve.client";
import { compileRule, compileScript } from "./sieve-compile";

interface SieveRuleRow {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  match: SieveMatch;
  conditions: SieveCondition[];
  actions: SieveAction[];
  script_source: string;
}

function toRule(row: SieveRuleRow): SieveRule {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    enabled: row.enabled,
    match: row.match,
    conditions: row.conditions,
    actions: row.actions,
    script_source: row.script_source,
  };
}

// How long to wait before re-pushing a mailbox's active script from listRules.
// Bounds ManageSieve traffic when the Filters panel refetches (window focus,
// remount) while still healing drift shortly after it appears.
const RECONCILE_TTL_SECONDS = 600;
const reconcileKey = (mailboxId: string) => `webmail:sieve:synced:${mailboxId}`;

@Injectable()
export class SieveService {
  private readonly logger = new Logger(SieveService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly credStore: WebmailCredentialStore,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  async listRules(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<SieveRule[]> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal);
    const rows = await this.loadRules(mailboxId);
    await this.reconcile(principal, mailboxId, address, rows);
    return rows.map(toRule);
  }

  async createRule(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: SieveRuleRequest,
  ): Promise<SieveRule> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal);
    const scriptSource = compileRule(input);
    const { rows } = await this.db.query<SieveRuleRow>(
      `INSERT INTO sieve_rules
         (org_id, mailbox_id, name, priority, enabled, match, conditions, actions, script_source)
       VALUES (
         $1, $2, $3,
         COALESCE((SELECT max(priority) + 1 FROM sieve_rules WHERE mailbox_id = $2), 0),
         $4, $5, $6::jsonb, $7::jsonb, $8)
       RETURNING id, name, priority, enabled, match, conditions, actions, script_source`,
      [
        orgId,
        mailboxId,
        input.name,
        input.enabled,
        input.match,
        JSON.stringify(input.conditions),
        JSON.stringify(input.actions),
        scriptSource,
      ],
    );
    await this.sync(principal, mailboxId, address);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.sieve.create",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { rule: rows[0]!.id, name: input.name },
    });
    return toRule(rows[0]!);
  }

  async updateRule(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
    input: SieveRuleRequest,
  ): Promise<SieveRule> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal);
    const scriptSource = compileRule(input);
    const { rows } = await this.db.query<SieveRuleRow>(
      `UPDATE sieve_rules
          SET name = $3, enabled = $4, match = $5,
              conditions = $6::jsonb, actions = $7::jsonb,
              script_source = $8, updated_at = now()
        WHERE id = $1 AND mailbox_id = $2
        RETURNING id, name, priority, enabled, match, conditions, actions, script_source`,
      [
        id,
        mailboxId,
        input.name,
        input.enabled,
        input.match,
        JSON.stringify(input.conditions),
        JSON.stringify(input.actions),
        scriptSource,
      ],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Filter not found" });
    await this.sync(principal, mailboxId, address);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.sieve.update",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { rule: id, name: input.name },
    });
    return toRule(rows[0]);
  }

  async deleteRule(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
  ): Promise<void> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal);
    const { rowCount } = await this.db.query(
      `DELETE FROM sieve_rules WHERE id = $1 AND mailbox_id = $2`,
      [id, mailboxId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Filter not found" });
    await this.sync(principal, mailboxId, address);
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.sieve.delete",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { rule: id },
    });
  }

  private async loadRules(mailboxId: string): Promise<SieveRuleRow[]> {
    const { rows } = await this.db.query<SieveRuleRow>(
      `SELECT id, name, priority, enabled, match, conditions, actions, script_source
         FROM sieve_rules WHERE mailbox_id = $1
        ORDER BY priority ASC, created_at ASC`,
      [mailboxId],
    );
    return rows;
  }

  // Recompile every enabled rule (in priority order) into the mailbox's single
  // active Sieve script and upload it over ManageSieve.
  private async sync(
    principal: SessionPrincipal,
    mailboxId: string,
    address: string,
  ): Promise<void> {
    const creds = await this.credStore.get(principal.sessionId, mailboxId);
    if (!creds) {
      throw new ForbiddenException({
        title: "Mailbox locked",
        detail: "Unlock the mailbox first by entering its password.",
      });
    }
    const enabled = (await this.loadRules(mailboxId)).filter((r) => r.enabled);
    const script = compileScript(enabled);
    try {
      await this.pushScript(address, creds.password, script);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`sieve sync failed for ${address}: ${message}`);
      throw new BadGatewayException({
        title: "Filter saved, but activating it on the mail server failed",
        detail: message,
      });
    }
    await this.markReconciled(mailboxId);
  }

  // Heal drift between the stored rules and the server's active script. A rule
  // saved while ManageSieve was unreachable lives in the DB but was never
  // uploaded, so mail is never filed. Re-push on Filters-panel load, at most
  // once per RECONCILE_TTL and only when the mailbox is unlocked. Best-effort:
  // listing never fails because activation did.
  private async reconcile(
    principal: SessionPrincipal,
    mailboxId: string,
    address: string,
    rows: SieveRuleRow[],
  ): Promise<void> {
    const enabled = rows.filter((r) => r.enabled);
    if (enabled.length === 0) return;
    const creds = await this.credStore.get(principal.sessionId, mailboxId);
    if (!creds) return;
    if (this.redis) {
      const lease = await this.redis.set(
        reconcileKey(mailboxId),
        "1",
        "EX",
        RECONCILE_TTL_SECONDS,
        "NX",
      );
      if (lease !== "OK") return;
    }
    try {
      await this.pushScript(address, creds.password, compileScript(enabled));
    } catch (err) {
      this.logger.warn(
        `sieve reconcile skipped for ${address}: ${(err as Error).message}`,
      );
    }
  }

  private async markReconciled(mailboxId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis
      .set(reconcileKey(mailboxId), "1", "EX", RECONCILE_TTL_SECONDS)
      .catch(() => {});
  }

  // Upload the compiled script as the mailbox's single active Sieve script.
  private async pushScript(
    address: string,
    password: string,
    script: string,
  ): Promise<void> {
    const client = await ManageSieveClient.connect({
      host: config.SIEVE_HOST,
      port: config.SIEVE_PORT,
      rejectUnauthorized: config.SIEVE_TLS_REJECT_UNAUTHORIZED,
      connectTimeoutMs: config.SIEVE_CONNECT_TIMEOUT_SECONDS * 1_000,
    });
    try {
      await client.startTls(config.SIEVE_TLS_REJECT_UNAUTHORIZED);
      await client.authenticate(address, password);
      await client.putScript(config.SIEVE_SCRIPT_NAME, script);
      await client.setActive(config.SIEVE_SCRIPT_NAME);
      await client.logout();
    } catch (err) {
      client.close();
      throw err;
    }
  }

  private async resolveMailbox(
    orgId: string,
    mailboxId: string,
    principal: SessionPrincipal,
  ): Promise<string> {
    if (principal.mailboxId) {
      if (
        principal.mailboxId !== mailboxId ||
        (principal.orgId != null && principal.orgId !== orgId)
      ) {
        throw new ForbiddenException({ title: "Mailbox not accessible" });
      }
    } else {
      await this.orgs.requireRole(orgId, principal.userId, "member");
    }
    const { rows } = await this.db.query<{ address: string }>(
      `SELECT (m.local_part || '@' || d.name) AS address
         FROM mailboxes m JOIN domains d ON d.id = m.domain_id
        WHERE m.id = $1 AND d.org_id = $2`,
      [mailboxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Mailbox not found" });
    return rows[0].address;
  }
}
