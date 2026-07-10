// Thin CalDAV client over global fetch, mirroring the CardDAV client. It
// brokers to Radicale on the internal network via the trusted X-Remote-User
// header. Listing uses PROPFIND to enumerate .ics hrefs, then GETs each event —
// this avoids parsing iCalendar bodies out of the multistatus XML.

import { Logger } from "@nestjs/common";
import { config } from "../config";

export interface EventResource {
  href: string;
  body: string;
}

const logger = new Logger("CalDavClient");

function base(): string {
  return config.RADICALE_URL.replace(/\/+$/, "");
}

function collectionUrl(user: string): string {
  return `${base()}/${encodeURIComponent(user)}/${encodeURIComponent(
    config.RADICALE_CALENDAR_COLLECTION,
  )}/`;
}

function headers(
  user: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return { "X-Remote-User": user, ...extra };
}

function resolveHref(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  const origin = new URL(base());
  return `${origin.protocol}//${origin.host}${href}`;
}

function extractHrefs(xml: string): string[] {
  const out: string[] = [];
  const re = /<(?:[a-z0-9]+:)?href>([^<]+)<\/(?:[a-z0-9]+:)?href>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const href = m[1]!.trim();
    if (href.toLowerCase().endsWith(".ics")) out.push(href);
  }
  return out;
}

async function ensureCollection(user: string): Promise<void> {
  const body =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">` +
    `<D:set><D:prop>` +
    `<C:supported-calendar-component-set>` +
    `<C:comp name="VEVENT"/>` +
    `</C:supported-calendar-component-set>` +
    `</D:prop></D:set></C:mkcalendar>`;
  const res = await fetch(collectionUrl(user), {
    method: "MKCALENDAR",
    headers: headers(user, { "Content-Type": "application/xml; charset=utf-8" }),
    body,
  });
  // 201 = created; 405 = already exists. Anything else is a real failure.
  if (res.status !== 201 && res.status !== 405) {
    const text = await res.text().catch(() => "");
    throw new Error(`MKCALENDAR failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function listEvents(user: string): Promise<EventResource[]> {
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
  const events: EventResource[] = [];
  for (const href of hrefs) {
    const url = resolveHref(href);
    const ev = await fetch(url, { method: "GET", headers: headers(user) });
    if (ev.ok) {
      events.push({ href, body: await ev.text() });
    } else if (ev.status !== 404) {
      logger.warn(`GET event failed (${ev.status}) for ${href}`);
    }
  }
  return events;
}

export async function putEvent(
  user: string,
  uid: string,
  body: string,
): Promise<string> {
  const href = `${collectionUrl(user)}${encodeURIComponent(uid)}.ics`;
  const res = await fetch(href, {
    method: "PUT",
    headers: headers(user, { "Content-Type": "text/calendar; charset=utf-8" }),
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return new URL(href).pathname;
}

export async function deleteEvent(user: string, href: string): Promise<void> {
  const url = resolveHref(href);
  const res = await fetch(url, { method: "DELETE", headers: headers(user) });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(`DELETE failed (${res.status}): ${text.slice(0, 200)}`);
  }
}
