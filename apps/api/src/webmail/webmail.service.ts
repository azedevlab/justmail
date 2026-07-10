import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ImapFlow, type MessageStructureObject } from "imapflow";
import { parseMime } from "@justmail/mail-parser";
import nodemailer from "nodemailer";
import { z } from "zod";
import { ComposeRequest, FlagAction } from "@justmail/contracts";
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
        type Item = {
          uid: number;
          seq: number;
          flags: string[];
          envelope: unknown;
          size: number;
          date: string | null;
          preview: string;
          has_attachments: boolean;
          thread_id: string | null;
        };
        const items: Item[] = [];
        // part key -> { uids, encoding } for a single grouped snippet fetch
        const textParts = new Map<
          number,
          { key: string; encoding: string }
        >();
        for await (const msg of client.fetch(range, {
          uid: true,
          envelope: true,
          flags: true,
          size: true,
          internalDate: true,
          bodyStructure: true,
          threadId: true,
        })) {
          items.push({
            uid: msg.uid,
            seq: msg.seq,
            flags: [...(msg.flags ?? [])],
            envelope: msg.envelope,
            size: msg.size ?? 0,
            date: msg.internalDate
              ? new Date(msg.internalDate).toISOString()
              : null,
            preview: "",
            has_attachments: msg.bodyStructure
              ? structureHasAttachments(msg.bodyStructure)
              : false,
            thread_id: msg.threadId ?? null,
          });
          const text = msg.bodyStructure
            ? findTextNode(msg.bodyStructure)
            : undefined;
          if (text) {
            textParts.set(msg.uid, {
              key: text.part ?? "1",
              encoding: (text.encoding ?? "").toLowerCase(),
            });
          }
        }

        // Fetch bounded snippets grouped by identical part key (most mail
        // shares "1" or "1.1"), so this is a handful of extra commands.
        const byKey = new Map<string, number[]>();
        for (const [uid, t] of textParts) {
          const list = byKey.get(t.key) ?? [];
          list.push(uid);
          byKey.set(t.key, list);
        }
        const previews = new Map<number, string>();
        for (const [key, uids] of byKey) {
          for await (const msg of client.fetch(
            uids,
            { uid: true, bodyParts: [{ key, start: 0, maxLength: 1024 }] },
            { uid: true },
          )) {
            const buf = msg.bodyParts?.get(key);
            if (!buf) continue;
            previews.set(
              msg.uid,
              snippetFromPart(buf, textParts.get(msg.uid)?.encoding ?? ""),
            );
          }
        }
        for (const it of items) {
          it.preview = previews.get(it.uid) ?? "";
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
          headers: parsed.headers,
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
    action: FlagAction,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(creds, async (client) => {
      // spam/not_spam are folder moves (mark-as-spam == relocate to Junk), so
      // resolve destinations before taking the source lock.
      if (action === "spam" || action === "not_spam") {
        const dest =
          action === "spam"
            ? await this.resolveSpecialFolder(client, "\\Junk", "Junk")
            : "INBOX";
        const lock = await client.getMailboxLock(folder);
        try {
          await client.messageMove(String(uid), dest, { uid: true });
        } finally {
          lock.release();
        }
        return;
      }

      const lock = await client.getMailboxLock(folder);
      try {
        const flagMap: Record<string, { flag: string; add: boolean }> = {
          read: { flag: "\\Seen", add: true },
          unread: { flag: "\\Seen", add: false },
          star: { flag: "\\Flagged", add: true },
          unstar: { flag: "\\Flagged", add: false },
          important: { flag: "$Important", add: true },
          not_important: { flag: "$Important", add: false },
        };
        const op = flagMap[action]!;
        if (op.add) {
          await client.messageFlagsAdd(String(uid), [op.flag], { uid: true });
        } else {
          await client.messageFlagsRemove(String(uid), [op.flag], {
            uid: true,
          });
        }
      } finally {
        lock.release();
      }
    });
  }

  private async resolveSpecialFolder(
    client: ImapFlow,
    use: string,
    fallback: string,
  ): Promise<string> {
    for (const b of await client.list()) {
      if (b.specialUse === use) return b.path;
    }
    return fallback;
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
    input: ComposeRequest,
  ) {
    // Guard fields the contract accepts but this milestone can't fulfil yet, so
    // a client never believes a scheduled/stored-attachment send succeeded.
    if (input.attachment_ids?.length) {
      throw new BadRequestException({
        title: "Stored attachments not supported yet",
        detail: "Send attachments inline; attachment_ids lands with storage-backed uploads.",
      });
    }
    if (input.send_at) {
      throw new BadRequestException({
        title: "Scheduled send not supported yet",
        detail: "Remove send_at; scheduled delivery is not available yet.",
      });
    }
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
      inReplyTo: input.in_reply_to,
      references: input.references,
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

function toNodemailerAttachments(
  attachments: ComposeRequest["attachments"],
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

function structureHasAttachments(node: MessageStructureObject): boolean {
  if (node.childNodes?.length) {
    return node.childNodes.some(structureHasAttachments);
  }
  const disp = (node.disposition ?? "").toLowerCase();
  if (disp === "attachment") return true;
  return Boolean(node.dispositionParameters?.filename);
}

function findTextNode(
  node: MessageStructureObject,
): MessageStructureObject | undefined {
  let plain: MessageStructureObject | undefined;
  let html: MessageStructureObject | undefined;
  const walk = (n: MessageStructureObject) => {
    if (n.childNodes?.length) {
      n.childNodes.forEach(walk);
      return;
    }
    const type = (n.type ?? "").toLowerCase();
    const disp = (n.disposition ?? "").toLowerCase();
    if (disp === "attachment") return;
    if (type === "text/plain" && !plain) plain = n;
    else if (type === "text/html" && !html) html = n;
  };
  walk(node);
  return plain ?? html;
}

function snippetFromPart(buf: Buffer, encoding: string): string {
  let text: string;
  if (encoding === "base64") {
    text = Buffer.from(buf.toString("ascii"), "base64").toString("utf8");
  } else if (encoding === "quoted-printable") {
    text = buf
      .toString("latin1")
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) =>
        String.fromCharCode(parseInt(h, 16)),
      );
  } else {
    text = buf.toString("utf8");
  }
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export const UnlockRequest = z.object({
  password: z.string().min(1).max(256),
});

export const MoveRequest = z.object({
  destination: z.string().min(1).max(500),
});

async function findSentBox(client: ImapFlow): Promise<string | null> {
  const boxes = await client.list();
  const sent = boxes.find((b) => (b.specialUse ?? "").toLowerCase() === "\\sent");
  return sent?.path ?? boxes.find((b) => b.name.toLowerCase() === "sent")?.path ?? null;
}

async function buildMimeMessage(
  input: ComposeRequest & { from: string },
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
    inReplyTo: input.in_reply_to,
    references: input.references,
    attachments: toNodemailerAttachments(input.attachments),
  });
  return compiled.message as Buffer;
}
