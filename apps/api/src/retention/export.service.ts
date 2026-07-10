import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import type { MailboxExport } from "@justmail/contracts";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import { StorageService } from "../storage/storage.service";
import type { SessionPrincipal } from "../auth/auth.service";
import { MasterImap } from "./master-imap";

interface ExportRow {
  id: string;
  org_id: string;
  mailbox_id: string;
  mailbox_address: string | null;
  format: "mbox";
  status: MailboxExport["status"];
  message_count: number;
  size_bytes: string | number;
  storage_key: string | null;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly master: MasterImap,
  ) {}

  async list(orgId: string, userId: string): Promise<MailboxExport[]> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const { rows } = await this.db.query<ExportRow>(
      `${SELECT} WHERE e.org_id = $1 ORDER BY e.created_at DESC LIMIT 100`,
      [orgId],
    );
    return rows.map(toExport);
  }

  async get(orgId: string, id: string, userId: string): Promise<MailboxExport> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const row = await this.loadRow(orgId, id);
    return toExport(row);
  }

  async request(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    ip?: string,
  ): Promise<MailboxExport> {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    if (!this.master.configured) {
      throw new ConflictException({
        title: "Exports unavailable",
        detail: "Configure a Dovecot master user to enable mailbox exports.",
      });
    }
    const { rows: mb } = await this.db.query<{ address: string }>(
      `SELECT m.local_part || '@' || d.name AS address
       FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE m.id = $1 AND d.org_id = $2`,
      [mailboxId, orgId],
    );
    if (!mb[0]) throw new NotFoundException({ title: "Mailbox not found" });

    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO mailbox_exports (org_id, mailbox_id, requested_by)
       VALUES ($1, $2, $3) RETURNING id`,
      [orgId, mailboxId, principal.userId],
    );
    const id = rows[0]!.id;
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "mailbox.export.request",
      targetType: "mailbox",
      targetId: mailboxId,
      ip,
    });
    // Run in the background; the row tracks progress and errors.
    void this.run(orgId, id, mb[0].address);
    return this.get(orgId, id, principal.userId);
  }

  /** Open a readable stream + size for a finished export archive. */
  async openArchive(
    orgId: string,
    id: string,
    userId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; size: number; filename: string }> {
    await this.orgs.requireRole(orgId, userId, "admin");
    const row = await this.loadRow(orgId, id);
    if (row.status !== "done" || !row.storage_key) {
      throw new ConflictException({ title: "Export is not ready" });
    }
    const head = await this.storage.head(orgId, row.storage_key);
    const stream = await this.storage.stream(orgId, row.storage_key);
    const label = (row.mailbox_address ?? "mailbox").replace(/[^a-z0-9@._-]/gi, "_");
    return {
      stream,
      size: head.size || Number(row.size_bytes),
      filename: `${label}.mbox`,
    };
  }

  private async run(orgId: string, id: string, address: string): Promise<void> {
    await this.db.query(
      "UPDATE mailbox_exports SET status = 'running', started_at = now() WHERE id = $1",
      [id],
    );
    try {
      const { buffer, count } = await this.buildMbox(address);
      const relKey = `exports/${id}.mbox`;
      await this.storage.put(orgId, relKey, buffer, "application/mbox");
      await this.db.query(
        `UPDATE mailbox_exports
         SET status = 'done', message_count = $2, size_bytes = $3,
             storage_key = $4, finished_at = now()
         WHERE id = $1`,
        [id, count, buffer.length, relKey],
      );
    } catch (err) {
      this.logger.warn(`export ${id} failed: ${(err as Error).message}`);
      await this.db.query(
        `UPDATE mailbox_exports SET status = 'error', error = $2, finished_at = now()
         WHERE id = $1`,
        [id, (err as Error).message.slice(0, 500)],
      );
    }
  }

  private async buildMbox(
    address: string,
  ): Promise<{ buffer: Buffer; count: number }> {
    return this.master.withClient(address, async (client) => {
      const parts: Buffer[] = [];
      let count = 0;
      const folders = await client.list();
      for (const folder of folders) {
        const lock = await client.getMailboxLock(folder.path).catch(() => null);
        if (!lock) continue;
        try {
          for await (const msg of client.fetch(
            "1:*",
            { source: true, internalDate: true },
            { uid: true },
          )) {
            if (!msg.source) continue;
            const when = new Date(msg.internalDate ?? Date.now()).toUTCString();
            parts.push(Buffer.from(`From MAILER-DAEMON ${when}\n`, "utf8"));
            parts.push(escapeMbox(msg.source));
            parts.push(Buffer.from("\n", "utf8"));
            count++;
          }
        } finally {
          lock.release();
        }
      }
      return { buffer: Buffer.concat(parts), count };
    });
  }

  private async loadRow(orgId: string, id: string): Promise<ExportRow> {
    const { rows } = await this.db.query<ExportRow>(
      `${SELECT} WHERE e.org_id = $1 AND e.id = $2`,
      [orgId, id],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Export not found" });
    return rows[0];
  }
}

const SELECT = `SELECT e.id, e.org_id, e.mailbox_id,
       m.local_part || '@' || d.name AS mailbox_address,
       e.format, e.status, e.message_count, e.size_bytes, e.storage_key,
       e.error, e.created_at, e.finished_at
FROM mailbox_exports e
LEFT JOIN mailboxes m ON m.id = e.mailbox_id
LEFT JOIN domains d ON d.id = m.domain_id`;

// mboxrd escaping: prefix any line of ">*From " with an extra ">" so the
// From_ delimiter stays unambiguous. Operate in latin1 to round-trip bytes.
export function escapeMbox(source: Buffer): Buffer {
  const text = source.toString("latin1");
  const escaped = text.replace(/^(>*From )/gm, ">$1");
  return Buffer.from(escaped, "latin1");
}

function toExport(r: ExportRow): MailboxExport {
  return {
    id: r.id,
    org_id: r.org_id,
    mailbox_id: r.mailbox_id,
    mailbox_address: r.mailbox_address,
    format: "mbox",
    status: r.status,
    message_count: r.message_count,
    size_bytes: Number(r.size_bytes),
    error: r.error,
    created_at: r.created_at.toISOString(),
    finished_at: r.finished_at ? r.finished_at.toISOString() : null,
  };
}
