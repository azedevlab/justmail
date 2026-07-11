// Thin CardDAV client over global fetch. It brokers to Radicale on the internal
// network, asserting the mailbox identity via the X-Remote-User header that
// Radicale trusts there (http_x_remote_user auth). Listing uses PROPFIND to
// enumerate card hrefs, then GETs each card — this avoids parsing vCard bodies
// out of the multistatus XML and needing an XML dependency.

import { Logger } from "@nestjs/common";
import { config } from "../config";

export interface CardResource {
  href: string;
  body: string;
}

const logger = new Logger("CardDavClient");

function base(): string {
  return config.RADICALE_URL.replace(/\/+$/, "");
}

// Collection URL for a mailbox's address book: <radicale>/<user>/<collection>/
function collectionUrl(user: string): string {
  return `${base()}/${encodeURIComponent(user)}/${encodeURIComponent(
    config.RADICALE_CONTACTS_COLLECTION,
  )}/`;
}

function headers(
  user: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return { "X-Remote-User": user, ...extra };
}

// Resolve an href from a multistatus response against the collection origin.
// Radicale returns absolute-path hrefs (e.g. /user/contacts/uid.vcf).
function resolveHref(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  const origin = new URL(base());
  return `${origin.protocol}//${origin.host}${href}`;
}

// Extract <href> values from a WebDAV multistatus body. A regex is sufficient
// here: Radicale emits flat, predictable XML and we only need the hrefs.
function extractHrefs(xml: string): string[] {
  const out: string[] = [];
  const re = /<(?:[a-z0-9]+:)?href>([^<]+)<\/(?:[a-z0-9]+:)?href>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const href = m[1]!.trim();
    if (href.toLowerCase().endsWith(".vcf")) out.push(href);
  }
  return out;
}

async function ensureCollection(user: string): Promise<void> {
  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<C:mkcol xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">` +
    `<D:set><D:prop><D:resourcetype>` +
    `<D:collection/><C:addressbook/>` +
    `</D:resourcetype></D:prop></D:set></C:mkcol>`;
  const res = await fetch(collectionUrl(user), {
    method: "MKCOL",
    headers: headers(user, { "Content-Type": "application/xml; charset=utf-8" }),
    body,
  });
  // 201 = created; 405/409 = already exists. Radicale returns 409 Conflict
  // (rather than the WebDAV-conventional 405) for an existing collection, so we
  // must treat it as success and let the subsequent PROPFIND enumerate it.
  if (res.status !== 201 && res.status !== 405 && res.status !== 409) {
    const text = await res.text().catch(() => "");
    throw new Error(`MKCOL failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function listCards(user: string): Promise<CardResource[]> {
  await ensureCollection(user);
  const propfind =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<D:propfind xmlns:D="DAV:"><D:prop><D:getetag/></D:prop></D:propfind>`;
  const res = await fetch(collectionUrl(user), {
    method: "PROPFIND",
    headers: headers(user, {
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    }),
    body: propfind,
  });
  if (res.status !== 207) {
    const text = await res.text().catch(() => "");
    throw new Error(`PROPFIND failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const hrefs = extractHrefs(await res.text());
  const cards: CardResource[] = [];
  for (const href of hrefs) {
    const url = resolveHref(href);
    const card = await fetch(url, { method: "GET", headers: headers(user) });
    if (card.ok) {
      cards.push({ href, body: await card.text() });
    } else if (card.status !== 404) {
      logger.warn(`GET card failed (${card.status}) for ${href}`);
    }
  }
  return cards;
}

export async function putCard(
  user: string,
  uid: string,
  body: string,
): Promise<string> {
  const href = `${collectionUrl(user)}${encodeURIComponent(uid)}.vcf`;
  const res = await fetch(href, {
    method: "PUT",
    headers: headers(user, { "Content-Type": "text/vcard; charset=utf-8" }),
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT failed (${res.status}): ${text.slice(0, 200)}`);
  }
  // Return the path-relative href for storage/round-tripping.
  return new URL(href).pathname;
}

export async function deleteCard(user: string, href: string): Promise<void> {
  const url = resolveHref(href);
  const res = await fetch(url, { method: "DELETE", headers: headers(user) });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
