import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ImapFlow } from "imapflow";
import { parseMime } from "@justmail/mail-parser";
import nodemailer from "nodemailer";
import { z } from "zod";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuditService } from "../audit/audit.service";
import { open, seal } from "../common/secretbox";
import { config } from "../config";
import type { SessionPrincipal } from "../auth/auth.service";

const IMAP_HOST = "dovecot";
const IMAP_PORT = 993;
const SMTP_HOST = "postfix";
const SMTP_PORT = 587;

interface CachedCreds {
  address: string;
  password: string;
}

interface MailboxAccess {
  mailboxId: string;
  address: string;
  orgId: string;
}

// Password cache: users unlock a mailbox once per session; we seal the password
// with the platform key and stash it in a settings row keyed by session id.
const CACHE_KEY = (sessionId: string, mailboxId: string) =>
  `webmail.session:${sessionId}.${mailboxId}`;

@Injectable()
export class WebmailService {
  private readonly logger = new Logger(WebmailService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  /** Unlock the mailbox by verifying the current password against Dovecot. */
  async unlock(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    password: string,
  ): Promise<void> {
    const mb = await this.mailboxFor(orgId, mailboxId, principal.userId);
    // Try a lightweight IMAP login to confirm the password works.
    const client = this.imap(mb.address, password);
    try {
      await client.connect();
      await client.logout();
    } catch (err) {
      throw new ForbiddenException({
        title: "Wrong mailbox password",
        detail: (err as Error).message.slice(0, 200),
      });
    }
    await this.db.query(
      `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [
        CACHE_KEY(principal.sessionId, mailboxId),
        JSON.stringify({ address: mb.address, sealed: seal(password) }),
        principal.userId,
      ],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.unlock",
      targetType: "mailbox",
      targetId: mailboxId,
    });
  }

  async lock(principal: SessionPrincipal, mailboxId: string) {
    await this.db.query("DELETE FROM settings WHERE key = $1", [
      CACHE_KEY(principal.sessionId, mailboxId),
    ]);
  }

  async listFolders(principal: SessionPrincipal, orgId: string, mailboxId: string) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const boxes = await client.list();
      return boxes.map((b) => ({
        path: b.path,
        name: b.name,
        specialUse: b.specialUse ?? null,
        flags: [...(b.flags ?? [])],
      }));
    });
  }

  async listMessages(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    limit: number,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const status = client.mailbox && typeof client.mailbox === "object"
          ? (client.mailbox as { exists: number }).exists
          : 0;
        if (!status) return { messages: [], total: 0 };
        const from = Math.max(status - limit + 1, 1);
        const range = `${from}:${status}`;
        const items: Array<{
          uid: number;
          seq: number;
          flags: string[];
          envelope: unknown;
          size: number;
          date: string | null;
        }> = [];
        for await (const msg of client.fetch(range, {
          uid: true,
          envelope: true,
          flags: true,
          size: true,
          internalDate: true,
        })) {
          items.push({
            uid: msg.uid,
            seq: msg.seq,
            flags: [...(msg.flags ?? [])],
            envelope: msg.envelope,
            size: msg.size ?? 0,
            date: msg.internalDate ? new Date(msg.internalDate).toISOString() : null,
          });
        }
        items.reverse();
        return { messages: items, total: status };
      } finally {
        lock.release();
      }
    });
  }

  async getMessage(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    uid: number,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const raw = await client.download(String(uid), undefined, { uid: true });
        if (!raw) throw new NotFoundException({ title: "Message not found" });
        const parsed = await parseMime(raw.content);
        return {
          uid,
          subject: parsed.subject,
          from: parsed.from,
          to: parsed.to,
          date: parsed.date?.toISOString() ?? null,
          text: parsed.text,
          html: parsed.html,
          attachments: parsed.attachments.map((a) => ({
            filename: a.filename,
            size: a.size,
            mime: a.contentType,
          })),
        };
      } finally {
        lock.release();
      }
    });
  }

  async setFlag(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    uid: number,
    action: "read" | "unread" | "star" | "unstar",
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const seen = action === "read" || action === "unread";
        const flags = seen ? ["\\Seen"] : ["\\Flagged"];
        if (action === "read" || action === "star") {
          await client.messageFlagsAdd(String(uid), flags, { uid: true });
        } else {
          await client.messageFlagsRemove(String(uid), flags, { uid: true });
        }
      } finally {
        lock.release();
      }
    });
  }

  async move(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    uid: number,
    dest: string,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageMove(String(uid), dest, { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    uid: number,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageDelete(String(uid), { uid: true });
      } finally {
        lock.release();
      }
    });
  }

  async send(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      text: string;
      html?: string;
    },
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: creds.address, pass: creds.password },
      tls: { rejectUnauthorized: false },
    });
    const info = await transport.sendMail({
      from: creds.address,
      to: input.to.join(", "),
      cc: input.cc?.join(", ") ?? undefined,
      bcc: input.bcc?.join(", ") ?? undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    // Append to Sent for a proper "sent" trail.
    try {
      const client = this.imap(creds.address, creds.password);
      await client.connect();
      try {
        const sent = await findSentBox(client);
        if (sent) {
          const message = await buildMimeMessage({
            from: creds.address,
            ...input,
          });
          await client.append(sent, message, ["\\Seen"]);
        }
      } finally {
        await client.logout();
      }
    } catch (err) {
      this.logger.warn(`append to Sent failed: ${(err as Error).message}`);
    }
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "webmail.send",
      targetType: "mailbox",
      targetId: mailboxId,
      meta: { subject: input.subject, to: input.to.length },
    });
    return { messageId: info.messageId };
  }

  private async creds(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<CachedCreds> {
    await this.mailboxFor(orgId, mailboxId, principal.userId);
    const { rows } = await this.db.query<{ value: { address: string; sealed: string } }>(
      "SELECT value FROM settings WHERE key = $1",
      [CACHE_KEY(principal.sessionId, mailboxId)],
    );
    const v = rows[0]?.value;
    if (!v) {
      throw new ForbiddenException({
        title: "Mailbox locked",
        detail: "Unlock the mailbox first by entering its password.",
      });
    }
    return { address: v.address, password: open(v.sealed) };
  }

  private async mailboxFor(
    orgId: string,
    mailboxId: string,
    userId: string,
  ): Promise<MailboxAccess> {
    await this.orgs.requireRole(orgId, userId, "member");
    const { rows } = await this.db.query<{
      id: string;
      address: string;
      org_id: string;
    }>(
      `SELECT m.id, (m.local_part || '@' || d.name) AS address, d.org_id
       FROM mailboxes m JOIN domains d ON d.id = m.domain_id
       WHERE m.id = $1 AND d.org_id = $2`,
      [mailboxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Mailbox not found" });
    return { mailboxId: rows[0].id, address: rows[0].address, orgId: rows[0].org_id };
  }

  private imap(address: string, password: string): ImapFlow {
    return new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: { user: address, pass: password },
      tls: { rejectUnauthorized: false },
      logger: false,
    });
  }

  private async withImap<T>(
    creds: CachedCreds,
    fn: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    const client = this.imap(creds.address, creds.password);
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
}

export const SendRequest = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().max(998).default(""),
  text: z.string().max(1_000_000).default(""),
  html: z.string().max(1_000_000).optional(),
});
export type SendRequest = z.infer<typeof SendRequest>;

export const UnlockRequest = z.object({
  password: z.string().min(1).max(256),
});

export const MoveRequest = z.object({
  destination: z.string().min(1).max(500),
});

export const FlagAction = z.enum(["read", "unread", "star", "unstar"]);

async function findSentBox(client: ImapFlow): Promise<string | null> {
  const boxes = await client.list();
  const sent = boxes.find((b) => (b.specialUse ?? "").toLowerCase() === "\\sent");
  return sent?.path ?? boxes.find((b) => b.name.toLowerCase() === "sent")?.path ?? null;
}

async function buildMimeMessage(input: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<string> {
  // Reuse nodemailer's compiler so we get a spec-compliant MIME body without
  // pulling in a second library.
  const compiler = nodemailer.createTransport({ jsonTransport: true });
  const compiled = await compiler.sendMail({
    from: input.from,
    to: input.to.join(", "),
    cc: input.cc?.join(", "),
    bcc: input.bcc?.join(", "),
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return (compiled.message as unknown as string) ?? "";
}

void config;
