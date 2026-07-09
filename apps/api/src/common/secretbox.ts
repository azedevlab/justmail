import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { config } from "../config";

// AES-256-GCM for small secrets at rest (TOTP seeds). Key from ENCRYPTION_KEY:
// 64-char hex is used as-is, anything else is stretched through sha256.
const KEY = /^[0-9a-f]{64}$/i.test(config.ENCRYPTION_KEY)
  ? Buffer.from(config.ENCRYPTION_KEY, "hex")
  : createHash("sha256").update(config.ENCRYPTION_KEY).digest();

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, ct, cipher.getAuthTag()]
    .map((b) => b.toString("base64url"))
    .join(".");
}

export function open(sealed: string): string {
  const [iv, ct, tag] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !ct || !tag) throw new Error("malformed sealed secret");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
