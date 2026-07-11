import {
  ForbiddenException,
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

@Injectable()
export class SieveService {
  private readonly logger = new Logger(SieveService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly credStore: WebmailCredentialStore,
  ) {}

  async listRules(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<SieveRule[]> {
    await this.resolveMailbox(orgId, mailboxId, principal.userId);
    return (await this.loadRules(mailboxId)).map(toRule);
  }

  async createRule(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: SieveRuleRequest,
  ): Promise<SieveRule> {
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
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
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
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
    const address = await this.resolveMailbox(orgId, mailboxId, principal.userId);
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
    const client = await ManageSieveClient.connect({
      host: config.SIEVE_HOST,
      port: config.SIEVE_PORT,
      rejectUnauthorized: config.SIEVE_TLS_REJECT_UNAUTHORIZED,
      connectTimeoutMs: config.SIEVE_CONNECT_TIMEOUT_SECONDS * 1_000,
    });
    try {
      await client.startTls(config.SIEVE_TLS_REJECT_UNAUTHORIZED);
      await client.authenticate(address, creds.password);
      await client.putScript(config.SIEVE_SCRIPT_NAME, script);
      await client.setActive(config.SIEVE_SCRIPT_NAME);
      await client.logout();
    } catch (err) {
      client.close();
      this.logger.error(
        `sieve sync failed for ${address}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private async resolveMailbox(
    orgId: string,
    mailboxId: string,
    userId: string,
  ): Promise<string> {
    await this.orgs.requireRole(orgId, userId, "member");
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
