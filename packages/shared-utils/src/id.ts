/** Lightweight ID helpers used at UI boundaries. Not cryptographic. */

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function randomId(length = 12): string {
  let out = "";
  const buf = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i++) {
    out += alphabet[buf[i]! % alphabet.length];
  }
  return out;
}

export function idempotencyKey(): string {
  return `idem_${randomId(24)}`;
}
