import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Readable } from "node:stream";
import { ImapFlow, type MessageStructureObject } from "imapflow";
import { parseMime } from "@justmail/mail-parser";
import nodemailer from "nodemailer";
import { z } from "zod";
import {
  ComposeRequest,
  FlagAction,
  type Folder,
  type MessageList,
  type SaveDraftRequest,
  type SavedDraft,
} from "@justmail/contracts";
import MailComposer from "nodemailer/lib/mail-composer";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { AuditService } from "../audit/audit.service";
import { config } from "../config";
import type { SessionPrincipal } from "../auth/auth.service";
import { AttachmentsService } from "../attachments/attachments.service";
import { StorageService } from "../storage/storage.service";
import { ClamavService } from "../av/clamav.service";
import { SettingsService } from "../settings/settings.service";
import {
  type CachedCreds,
  WebmailCredentialStore,
} from "./credential.store";
import { ImapSessionManager } from "./imap-session.manager";
import { ImapIdleWatcher } from "./imap-idle.watcher";
import { WebmailCache } from "./webmail.cache";
import { computeThreadId, headerValue, parseReferences } from "./threading";

const IMAP_HOST = config.IMAP_HOST;
const IMAP_PORT = config.IMAP_PORT;
const SMTP_HOST = config.SMTP_HOST;
const SMTP_PORT = config.SMTP_PORT;

interface MailboxAccess {
  mailboxId: string;
  address: string;
  orgId: string;
}

interface StoredAttachment {
  id: string;
  filename: string;
  mime: string;
  content_hash: string;
  size_bytes: number;
}

interface StoredNodemailerAttachment {
  filename: string;
  contentType: string;
  content: Readable;
}

@Injectable()
export class WebmailService {
  private readonly logger = new Logger(WebmailService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
    private readonly credStore: WebmailCredentialStore,
    private readonly sessions: ImapSessionManager,
    private readonly idle: ImapIdleWatcher,
    private readonly cache: WebmailCache,
    private readonly attachments: AttachmentsService,
    private readonly storage: StorageService,
    private readonly av: ClamavService,
    private readonly settings: SettingsService,
  ) {}

  /** Arm IDLE-based realtime notifications for the open folder. */
  async startWatch(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
  ): Promise<void> {
    const creds = await this.creds(principal, orgId, mailboxId);
    await this.idle.watch(principal.sessionId, mailboxId, folder, creds);
  }

  async stopWatch(
    principal: SessionPrincipal,
    mailboxId: string,
  ): Promise<void> {
    await this.idle.unwatch(principal.sessionId, mailboxId);
  }

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
    await this.idle.unwatch(principal.sessionId, mailboxId);
  }

  async listFolders(principal: SessionPrincipal, orgId: string, mailboxId: string) {
    const cached = await this.cache.getFolders<Folder[]>(
      principal.sessionId,
      mailboxId,
    );
    if (cached) return cached;
    const creds = await this.creds(principal, orgId, mailboxId);
    const out = await this.withImap(
      principal.sessionId,
      mailboxId,
      creds,
      async (client) => {
        // LIST-STATUS (RFC 5819) folds STATUS into a single LIST round-trip when
        // the server supports it (Dovecot does); ImapFlow falls back to per-folder
        // STATUS commands otherwise. \Noselect folders surface status.error.
        const boxes = await client.list({
          statusQuery: { unseen: true, messages: true },
        });
        return boxes.map((b) => ({
          path: b.path,
          name: b.name,
          special_use: b.specialUse ?? null,
          unread: b.status?.unseen ?? 0,
          total: b.status?.messages ?? 0,
        }));
      },
    );
    await this.cache.setFolders(principal.sessionId, mailboxId, out);
    return out;
  }

  async listMessages(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    limit: number,
  ) {
    const cached = await this.cache.getMessageList<MessageList>(
      principal.sessionId,
      mailboxId,
      folder,
      limit,
    );
    if (cached) return cached;
    const creds = await this.creds(principal, orgId, mailboxId);
    const out = await this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const mb =
          client.mailbox && typeof client.mailbox === "object"
            ? client.mailbox
            : null;
        const uid_validity = mb?.uidValidity != null ? String(mb.uidValidity) : null;
        const mod_seq = mb?.highestModseq != null ? String(mb.highestModseq) : null;
        const status = mb?.exists ?? 0;
        if (!status)
          return { messages: [], total: 0, uid_validity, mod_seq };
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
          headers: ["references"],
        })) {
          const references = parseReferences(
            headerValue(msg.headers?.toString("utf8"), "references"),
          );
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
            thread_id: computeThreadId({
              nativeThreadId: msg.threadId ?? null,
              messageId: msg.envelope?.messageId ?? null,
              inReplyTo: msg.envelope?.inReplyTo ?? null,
              references,
              subject: msg.envelope?.subject ?? null,
            }),
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
        return { messages: items, total: status, uid_validity, mod_seq };
      } finally {
        lock.release();
      }
    });
    await this.cache.setMessageList(
      principal.sessionId,
      mailboxId,
      folder,
      limit,
      out,
    );
    return out;
  }

  // CONDSTORE delta: returns flag changes since the client's last modseq so the
  // realtime client can patch its cache instead of re-listing the whole folder.
  async syncMessages(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    since: bigint | null,
    clientUidValidity: string | null,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        const mb =
          client.mailbox && typeof client.mailbox === "object"
            ? client.mailbox
            : null;
        const uid_validity = mb?.uidValidity != null ? String(mb.uidValidity) : null;
        const mod_seq = mb?.highestModseq != null ? String(mb.highestModseq) : null;
        // UIDs are only stable within a uidvalidity generation; a change means
        // the client's cached UIDs are meaningless and it must reload in full.
        if (clientUidValidity && uid_validity && clientUidValidity !== uid_validity) {
          return { uid_validity, mod_seq, stale: true, changed: [] };
        }
        const changed: { uid: number; flags: string[] }[] = [];
        if (since != null && mb?.exists) {
          for await (const msg of client.fetch(
            "1:*",
            { uid: true, flags: true },
            { changedSince: since },
          )) {
            changed.push({ uid: msg.uid, flags: [...(msg.flags ?? [])] });
          }
        }
        return { uid_validity, mod_seq, stale: false, changed };
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
    ifNoneMatch?: string,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        // A UID's raw body is immutable within a uidvalidity generation, so the
        // pair is a sound ETag. Checking it before download lets a conditional
        // request skip the fetch + MIME parse entirely.
        const etag = messageEtag(client, uid);
        if (ifNoneMatch && ifNoneMatch === etag) {
          return { etag, notModified: true as const };
        }
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
          etag,
          message: {
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
          },
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
    ifNoneMatch?: string,
  ): Promise<
    | { notModified: true; etag: string }
    | { notModified: false; etag: string; filename: string; mime: string; content: Buffer }
  > {
    const creds = await this.creds(principal, orgId, mailboxId);
    return this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        // Attachment bytes are immutable for a given uid+index within a
        // uidvalidity generation, so this is a strong validator.
        const etag = `"a-${uidValidityOf(client)}-${uid}-${index}"`;
        if (ifNoneMatch && ifNoneMatch === etag) {
          return { notModified: true as const, etag };
        }
        const raw = await client.download(String(uid), undefined, { uid: true });
        if (!raw) throw new NotFoundException({ title: "Message not found" });
        const parsed = await parseMime(raw.content);
        const a = parsed.attachments[index];
        if (!a) throw new NotFoundException({ title: "Attachment not found" });
        return {
          notModified: false as const,
          etag,
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
    await this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
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
    await this.cache.bustMailbox(principal.sessionId, mailboxId);
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
    await this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageMove(String(uid), dest, { uid: true });
      } finally {
        lock.release();
      }
    });
    await this.cache.bustMailbox(principal.sessionId, mailboxId);
  }

  async remove(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    folder: string,
    uid: number,
  ) {
    const creds = await this.creds(principal, orgId, mailboxId);
    await this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageDelete(String(uid), { uid: true });
      } finally {
        lock.release();
      }
    });
    await this.cache.bustMailbox(principal.sessionId, mailboxId);
  }

  async send(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: ComposeRequest,
  ) {
    if (input.send_at) {
      throw new BadRequestException({
        title: "Scheduled send not supported yet",
        detail: "Remove send_at; scheduled delivery is not available yet.",
      });
    }
    // Resolve + virus-scan stored attachments before we touch SMTP.
    const stored = await this.resolveStoredAttachments(
      principal,
      orgId,
      input.attachment_ids ?? [],
    );
    const inlineBytes = (input.attachments ?? []).reduce(
      (sum, a) => sum + Math.ceil(a.content_base64.length * 0.75),
      0,
    );
    const storedBytes = stored.reduce((sum, s) => sum + s.size_bytes, 0);
    const totalCount = (input.attachments?.length ?? 0) + stored.length;
    const limits = await this.settings.attachmentLimits(orgId);
    if (totalCount > limits.maxCount) {
      throw new BadRequestException({
        title: "Too many attachments",
        detail: `Attach at most ${limits.maxCount} files.`,
      });
    }
    if (inlineBytes + storedBytes > limits.maxTotalBytes) {
      throw new BadRequestException({
        title: "Attachments too large",
        detail: `Total attachment size must stay under ${Math.floor(limits.maxTotalBytes / 1_000_000)} MB.`,
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
      attachments: [
        ...(toNodemailerAttachments(input.attachments) ?? []),
        ...(await this.storedNodemailerAttachments(orgId, stored)),
      ],
    });
    // Append to Sent for a proper "sent" trail.
    try {
      await this.withImap(
        principal.sessionId,
        mailboxId,
        creds,
        async (client) => {
          const sent = await findSentBox(client);
          if (sent) {
            const message = await buildMimeMessage(
              { from: creds.address, ...input },
              // Fresh streams: the send transport already consumed the first set.
              await this.storedNodemailerAttachments(orgId, stored),
            );
            await client.append(sent, message, ["\\Seen"]);
          }
        },
      );
    } catch (err) {
      this.logger.warn(`append to Sent failed: ${(err as Error).message}`);
    }
    // The Sent folder gained a message; drop this session's cached views.
    await this.cache.bustMailbox(principal.sessionId, mailboxId);
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

  /**
   * Append a draft to the IMAP \Drafts folder (best interop: drafts are visible
   * to every client). When replace_uid is given, the prior autosave is deleted
   * after the new one lands, so a compose session keeps a single live draft.
   */
  async saveDraft(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: SaveDraftRequest,
  ): Promise<SavedDraft> {
    const creds = await this.creds(principal, orgId, mailboxId);
    const result = await this.withImap(
      principal.sessionId,
      mailboxId,
      creds,
      async (client) => {
        const drafts = await findDraftsBox(client);
        if (!drafts) {
          throw new BadRequestException({
            title: "No Drafts folder",
            detail: "This mailbox has no Drafts folder to save into.",
          });
        }
        const message = await buildDraftMime({ from: creds.address, ...input });
        const appended = await client.append(drafts, message, [
          "\\Draft",
          "\\Seen",
        ]);
        const uid =
          appended && typeof appended === "object" && "uid" in appended
            ? (appended.uid ?? null)
            : null;
        if (input.replace_uid) {
          const lock = await client.getMailboxLock(drafts);
          try {
            await client.messageDelete(String(input.replace_uid), {
              uid: true,
            });
          } catch {
            // The prior draft may already be gone; deletion is best-effort.
          } finally {
            lock.release();
          }
        }
        return { uid, folder: drafts };
      },
    );
    await this.cache.bustMailbox(principal.sessionId, mailboxId);
    return result;
  }

  /** Delete a draft from the \Drafts folder by UID. */
  async discardDraft(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    uid: number,
  ): Promise<void> {
    const creds = await this.creds(principal, orgId, mailboxId);
    await this.withImap(principal.sessionId, mailboxId, creds, async (client) => {
      const drafts = await findDraftsBox(client);
      if (!drafts) return;
      const lock = await client.getMailboxLock(drafts);
      try {
        await client.messageDelete(String(uid), { uid: true });
      } catch {
        // Already discarded elsewhere; treat as success.
      } finally {
        lock.release();
      }
    });
    await this.cache.bustMailbox(principal.sessionId, mailboxId);
  }

  /**
   * Load stored attachments by id, enforce ownership, and virus-scan any that
   * are not yet marked clean. Throws before SMTP is touched if any is infected
   * or unscannable.
   */
  private async resolveStoredAttachments(
    principal: SessionPrincipal,
    orgId: string,
    ids: string[],
  ): Promise<StoredAttachment[]> {
    const out: StoredAttachment[] = [];
    for (const id of ids) {
      const att = await this.attachments.get(orgId, id, principal.userId);
      if (att.virus_status === "infected") {
        throw new BadRequestException({
          title: "Attachment blocked",
          detail: `"${att.filename}" was flagged by the virus scanner.`,
        });
      }
      if (this.av.enabled && att.virus_status !== "clean") {
        const key = `attachments/${att.content_hash}`;
        let clean = false;
        let signature: string | undefined;
        try {
          const stream = await this.storage.stream(orgId, key);
          const result = await this.av.scan(stream);
          clean = result.clean;
          signature = result.signature;
        } catch (err) {
          this.logger.warn(`virus scan failed: ${(err as Error).message}`);
          throw new BadRequestException({
            title: "Virus scan unavailable",
            detail: "An attachment could not be scanned. Please try again.",
          });
        }
        if (!clean) {
          await this.attachments.markVirusStatus(orgId, att.id, "infected");
          throw new BadRequestException({
            title: "Attachment blocked",
            detail: `"${att.filename}" was flagged as ${signature ?? "malware"}.`,
          });
        }
        await this.attachments.markVirusStatus(orgId, att.id, "clean");
      }
      out.push({
        id: att.id,
        filename: att.filename,
        mime: att.mime,
        content_hash: att.content_hash,
        size_bytes: att.size_bytes,
      });
    }
    return out;
  }

  /** Fresh storage streams for nodemailer; each call re-opens (streams are single-use). */
  private async storedNodemailerAttachments(
    orgId: string,
    stored: StoredAttachment[],
  ) {
    return Promise.all(
      stored.map(async (s) => ({
        filename: s.filename,
        contentType: s.mime,
        content: await this.storage.stream(orgId, `attachments/${s.content_hash}`),
      })),
    );
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
    sessionId: string,
    mailboxId: string,
    creds: CachedCreds,
    fn: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    return this.sessions.run(sessionId, mailboxId, creds, fn);
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

// UIDVALIDITY of the currently-open mailbox, or "0" if the server withheld it.
function uidValidityOf(client: ImapFlow): string {
  const mb = client.mailbox;
  return mb && typeof mb === "object" && mb.uidValidity != null
    ? String(mb.uidValidity)
    : "0";
}

// Weak ETag for a message body: content is fixed for a uid within a
// uidvalidity generation, but the value is derived rather than byte-exact.
function messageEtag(client: ImapFlow, uid: number): string {
  return `W/"m-${uidValidityOf(client)}-${uid}"`;
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

async function findDraftsBox(client: ImapFlow): Promise<string | null> {
  const boxes = await client.list();
  const drafts = boxes.find(
    (b) => (b.specialUse ?? "").toLowerCase() === "\\drafts",
  );
  return (
    drafts?.path ??
    boxes.find((b) => b.name.toLowerCase() === "drafts")?.path ??
    null
  );
}

// Compile draft MIME with MailComposer directly so unfinished/empty recipient
// lists don't trip the send-time recipient validation nodemailer applies.
export async function buildDraftMime(
  input: SaveDraftRequest & { from: string },
): Promise<Buffer> {
  const mail = new MailComposer({
    from: input.from,
    to: input.to.length > 0 ? input.to.join(", ") : undefined,
    cc: input.cc.length > 0 ? input.cc.join(", ") : undefined,
    bcc: input.bcc.length > 0 ? input.bcc.join(", ") : undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
    inReplyTo: input.in_reply_to,
    references: input.references,
  });
  return new Promise<Buffer>((resolve, reject) => {
    mail.compile().build((err, message) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}

async function buildMimeMessage(
  input: ComposeRequest & { from: string },
  storedAttachments: StoredNodemailerAttachment[] = [],
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
    attachments: [
      ...(toNodemailerAttachments(input.attachments) ?? []),
      ...storedAttachments,
    ],
  });
  return compiled.message as Buffer;
}
