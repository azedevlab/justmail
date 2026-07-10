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
import { config } from "../config";
import type { SessionPrincipal } from "../auth/auth.service";
import {
  type CachedCreds,
  WebmailCredentialStore,
} from "./credential.store";

const IMAP_HOST = config.IMAP_HOST;
const IMAP_PORT = config.IMAP_PORT;
const SMTP_HOST = config.SMTP_HOST;
const SMTP_PORT = config.SMTP_PORT;

interface MailboxAccess {
  mailboxId: string;
  address: string;
  orgId: string;
}

@Injectable()
export class WebmailService {
  private readonly logger = new Logger(WebmailService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly credStore: WebmailCredentialStore,
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
      this.logger.warn(
        `mailbox unlock failed for ${mb.address}: ${(err as Error).message}`,
      );
      throw new ForbiddenException({
        title: "Wrong mailbox password",
        detail: "The mailbox password was not accepted. Please try again.",
      });
    }
    await this.credStore.store(
      principal.sessionId,
      mailboxId,
      mb.address,
      password,
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
    await this.credStore.remove(principal.sessionId, mailboxId);
  }

  async listFolders(principal: SessionPrincipal, orgId: string, mailboxId: string) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const boxes = await client.list();
      const out = [];
      for (const b of boxes) {
        let unread = 0;
        let total = 0;
        try {
          const st = await client.status(b.path, {
            unseen: true,
            messages: true,
          });
          unread = st.unseen ?? 0;
          total = st.messages ?? 0;
        } catch {
          // \Noselect folders cannot be STATUSed
        }
        out.push({
          path: b.path,
          name: b.name,
          special_use: b.specialUse ?? null,
          unread,
          total,
        });
      }
      return out;
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
        // Inline cid: images as data URIs so the sandboxed viewer can render
        // them without a credentialed cross-origin request.
        let html = parsed.html;
        if (html) {
          for (const a of parsed.attachments) {
            if (!a.contentId || a.size > config.WEBMAIL_ATTACHMENT_INLINE_MAX_BYTES)
              continue;
            const cid = a.contentId.replace(/[<>]/g, "");
            if (cid && html.includes(`cid:${cid}`)) {
              html = html
                .split(`cid:${cid}`)
                .join(
                  `data:${a.contentType};base64,${a.content.toString("base64")}`,
                );
            }
          }
        }
        return {
          uid,
          message_id: parsed.message_id,
          subject: parsed.subject,
          from: parsed.from,
          to: parsed.to,
          cc: parsed.cc,
          date: parsed.date?.toISOString() ?? null,
          text: parsed.text,
          html,
          attachments: parsed.attachments.map((a, i) => ({
            id: String(i),
            filename: a.filename,
            size: a.size,
            mime: a.contentType,
            inline: a.disposition === "inline",
          })),
        };
      } finally {
        lock.release();
      }
    });
  }

  async getAttachment(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    uid: number,
    index: number,
  ): Promise<{ filename: string; mime: string; content: Buffer }> {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const raw = await client.download(String(uid), undefined, { uid: true });
        if (!raw) throw new NotFoundException({ title: "Message not found" });
        const parsed = await parseMime(raw.content);
        const a = parsed.attachments[index];
        if (!a) throw new NotFoundException({ title: "Attachment not found" });
        return {
          filename: a.filename || `attachment-${index}`,
          mime: a.contentType,
          content: a.content,
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
    input: SendRequest,
  ) {
    const totalBytes = (input.attachments ?? []).reduce(
      (sum, a) => sum + Math.ceil(a.content_base64.length * 0.75),
      0,
    );
    const maxTotal = config.WEBMAIL_ATTACHMENT_MAX_TOTAL_BYTES;
    if (totalBytes > maxTotal) {
      throw new BadRequestException({
        title: "Attachments too large",
        detail: `Total attachment size must stay under ${Math.floor(maxTotal / 1_000_000)} MB.`,
      });
    }
    const creds = await this.creds(principal, orgId, mailboxId);
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      requireTLS: true,
      auth: { user: creds.address, pass: creds.password },
      tls: { rejectUnauthorized: config.SMTP_TLS_REJECT_UNAUTHORIZED },
    });
    const info = await transport.sendMail({
      from: creds.address,
      to: input.to.join(", "),
      cc: input.cc?.join(", ") ?? undefined,
      bcc: input.bcc?.join(", ") ?? undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: toNodemailerAttachments(input.attachments),
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
    const creds = await this.credStore.get(principal.sessionId, mailboxId);
    if (!creds) {
      throw new ForbiddenException({
        title: "Mailbox locked",
        detail: "Unlock the mailbox first by entering its password.",
      });
    }
    return creds;
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
      tls: { rejectUnauthorized: config.IMAP_TLS_REJECT_UNAUTHORIZED },
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
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mime: z.string().max(255).default("application/octet-stream"),
        content_base64: z.string().max(20_000_000),
      }),
    )
    .max(config.WEBMAIL_ATTACHMENT_MAX_COUNT)
    .optional(),
});
export type SendRequest = z.infer<typeof SendRequest>;

function toNodemailerAttachments(
  attachments: SendRequest["attachments"],
):
  | Array<{ filename: string; content: Buffer; contentType: string }>
  | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.content_base64, "base64"),
    contentType: a.mime,
  }));
}

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

async function buildMimeMessage(
  input: SendRequest & { from: string },
): Promise<Buffer> {
  // Reuse nodemailer's compiler so we get a spec-compliant MIME body without
  // pulling in a second library.
  const compiler = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "\r\n",
  });
  const compiled = await compiler.sendMail({
    from: input.from,
    to: input.to.join(", "),
    cc: input.cc?.join(", "),
    bcc: input.bcc?.join(", "),
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: toNodemailerAttachments(input.attachments),
  });
  return compiled.message as Buffer;
}
