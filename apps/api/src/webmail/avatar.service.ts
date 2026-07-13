import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { StorageService } from "../storage/storage.service";
import { REDIS, type RedisClient } from "../common/redis.module";
import { config } from "../config";
import type { SessionPrincipal } from "../auth/auth.service";

// Formats we accept for a profile picture and the extension we store them under.
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const FETCH_TIMEOUT_MS = 4000;
// External images are proxied inline as data URLs, so keep them small.
const EXTERNAL_MAX_BYTES = 256 * 1024;

export interface AvatarResult {
  data_url: string | null;
}

/**
 * Resolves a display picture for any email address and manages a mailbox's own
 * self-service profile picture.
 *
 * Sender resolution order: a local mailbox's uploaded picture (same org) →
 * Gravatar by email hash → the sender domain's logo → none (client renders
 * initials). External lookups are proxied server-side so the browser never
 * contacts third parties, and cached in Redis (positive and negative).
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly storage: StorageService,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  private async assertAccess(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<void> {
    await this.orgs.requireOrgAccess(principal, orgId, "member");
    const { rows } = await this.db.query(
      `SELECT 1 FROM mailboxes m JOIN domains d ON d.id = m.domain_id
        WHERE m.id = $1 AND d.org_id = $2`,
      [mailboxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Mailbox not found" });
  }

  /** Resolve a sender (or the caller's own) avatar to an inline data URL. */
  async resolveForEmail(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    emailRaw: string,
  ): Promise<AvatarResult> {
    await this.assertAccess(principal, orgId, mailboxId);
    const email = (emailRaw ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { data_url: null };

    const local = await this.localAvatar(orgId, email);
    if (local) return { data_url: local };

    if (!config.AVATAR_PROXY_ENABLED) return { data_url: null };

    const cacheKey = `avatar:v1:${createHash("sha1").update(email).digest("hex")}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached !== undefined) return { data_url: cached || null };

    const resolved = await this.fetchExternal(email);
    await this.cacheSet(cacheKey, resolved ?? "");
    return { data_url: resolved };
  }

  /** Store (or replace) the caller's own profile picture from a data URL. */
  async setProfileAvatar(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    dataUrl: string,
  ): Promise<void> {
    await this.assertAccess(principal, orgId, mailboxId);
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl.trim());
    const mime = match?.[1]?.toLowerCase();
    if (!match || !mime || !MIME_EXT[mime]) {
      throw new BadRequestException({
        title: "Unsupported image",
        detail: "Upload a PNG, JPEG, WebP, or GIF image.",
      });
    }
    const buffer = Buffer.from(match[2]!, "base64");
    if (buffer.length === 0 || buffer.length > config.PROFILE_AVATAR_MAX_BYTES) {
      throw new BadRequestException({
        title: "Image too large",
        detail: `Profile picture must be under ${Math.floor(
          config.PROFILE_AVATAR_MAX_BYTES / 1000,
        )} KB.`,
      });
    }
    const ext = MIME_EXT[mime]!;
    const path = `avatars/mailbox/${mailboxId}.${ext}`;

    const prev = await this.db.query<{ avatar_path: string | null }>(
      "SELECT avatar_path FROM mailboxes WHERE id = $1",
      [mailboxId],
    );
    await this.storage.put(orgId, path, buffer, mime);
    const oldPath = prev.rows[0]?.avatar_path;
    if (oldPath && oldPath !== path) {
      await this.storage
        .remove(orgId, oldPath)
        .catch((e) => this.logger.warn(`stale avatar cleanup failed: ${e}`));
    }
    await this.db.query(
      "UPDATE mailboxes SET avatar_path = $2, avatar_updated_at = now() WHERE id = $1",
      [mailboxId, path],
    );
  }

  async removeProfileAvatar(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<void> {
    await this.assertAccess(principal, orgId, mailboxId);
    const { rows } = await this.db.query<{ avatar_path: string | null }>(
      "SELECT avatar_path FROM mailboxes WHERE id = $1",
      [mailboxId],
    );
    const path = rows[0]?.avatar_path;
    if (path) {
      await this.storage
        .remove(orgId, path)
        .catch((e) => this.logger.warn(`avatar delete failed: ${e}`));
    }
    await this.db.query(
      "UPDATE mailboxes SET avatar_path = NULL, avatar_updated_at = now() WHERE id = $1",
      [mailboxId],
    );
  }

  // Local mailbox in the same org with an uploaded picture.
  private async localAvatar(
    orgId: string,
    email: string,
  ): Promise<string | null> {
    const { rows } = await this.db.query<{ avatar_path: string }>(
      `SELECT m.avatar_path
         FROM mailboxes m JOIN domains d ON d.id = m.domain_id
        WHERE d.org_id = $1
          AND lower(m.local_part || '@' || d.name) = $2
          AND m.avatar_path IS NOT NULL
        LIMIT 1`,
      [orgId, email],
    );
    const path = rows[0]?.avatar_path;
    if (!path) return null;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = EXT_MIME[ext] ?? "application/octet-stream";
    try {
      const buffer = await streamToBuffer(
        this.storage.stream(orgId, path),
        config.PROFILE_AVATAR_MAX_BYTES,
      );
      return `data:${mime};base64,${buffer.toString("base64")}`;
    } catch (e) {
      this.logger.warn(`local avatar read failed for ${path}: ${e}`);
      return null;
    }
  }

  private async fetchExternal(email: string): Promise<string | null> {
    const md5 = createHash("md5").update(email).digest("hex");
    const gravatar = await this.fetchImage(
      `https://www.gravatar.com/avatar/${md5}?d=404&s=160`,
    );
    if (gravatar) return gravatar;

    const domain = email.split("@")[1] ?? "";
    if (config.AVATAR_LOGO_URL && DOMAIN_RE.test(domain)) {
      const url = config.AVATAR_LOGO_URL.replace(
        "{domain}",
        encodeURIComponent(domain),
      );
      if (isSafePublicUrl(url)) {
        const logo = await this.fetchImage(url);
        if (logo) return logo;
      }
    }
    return null;
  }

  private async fetchImage(url: string): Promise<string | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { accept: "image/*" },
      });
      if (!res.ok) return null;
      const type = res.headers.get("content-type")?.split(";")[0]?.trim();
      if (!type || !type.startsWith("image/")) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > EXTERNAL_MAX_BYTES) return null;
      return `data:${type};base64,${buf.toString("base64")}`;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // Returns the cached data URL, "" for a cached miss, or undefined if absent.
  private async cacheGet(key: string): Promise<string | undefined> {
    if (!this.redis) return undefined;
    const raw = await this.redis.get(key);
    return raw === null ? undefined : raw;
  }

  private async cacheSet(key: string, value: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(key, value, "EX", config.AVATAR_CACHE_TTL_SECONDS);
  }
}

async function streamToBuffer(
  stream: Readable | Promise<Readable>,
  maxBytes: number,
): Promise<Buffer> {
  const s = await stream;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of s) {
    const b = chunk as Buffer;
    total += b.length;
    if (total > maxBytes) throw new Error("avatar exceeds max bytes");
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

// Defence-in-depth for an operator-overridden AVATAR_LOGO_URL: only allow
// https to a non-private host so a hostile template can't turn the resolver
// into an SSRF probe of the internal network.
export function isSafePublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || (a === 192 && b === 168)) return false;
    if (a === 172 && b! >= 16 && b! <= 31) return false;
    if (a === 169 && b === 254) return false;
  }
  return true;
}
