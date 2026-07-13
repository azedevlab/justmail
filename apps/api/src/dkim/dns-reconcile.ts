/**
 * Pure matching logic for reconciling expected records against what a DNS
 * provider already holds. Split out from DnsService so the delicate "which
 * existing record is *this* one" decision is unit-tested — getting it wrong
 * clobbers unrelated records (e.g. a Google site-verification TXT) or leaves
 * duplicate SPF/DKIM records that keep the check red.
 */

export interface ProviderRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  priority?: number;
  ttl: number;
}

export interface ExpectedRecord {
  type: string;
  name: string;
  content: string;
}

export function strip(s: string): string {
  return s.replace(/^"|"$/g, "").trim();
}

// The scheme token that identifies what a TXT record is *for*. Two TXT records
// with the same kind at the same name are the same logical record (one is a
// stale duplicate); a TXT whose kind we don't recognise is unmanaged and must
// never be touched.
export function txtKind(content: string): string | null {
  const c = strip(content).toLowerCase();
  const m = c.match(/^(v=spf1|v=dmarc1|v=stsv1|v=tlsrptv1|v=bimi1|v=dkim1)\b/);
  if (m) return m[1] ?? null;
  if (c.startsWith("justmail-verify=")) return "justmail-verify";
  return null;
}

// A CAA record reduced to the three fields that define its identity. Flags,
// tag (issue/issuewild/iodef/…) and the quoted value, all case-folded so a
// resolver answer can be compared against our BIND-style desired content.
export interface CaaTuple {
  flags: number;
  tag: string;
  value: string;
}

// Parse a CAA record from either BIND-style text (`0 issue "letsencrypt.org"`)
// or a Node resolver object (`{ critical: 0, issue: "letsencrypt.org" }`).
export function parseCaa(
  input: string | Record<string, unknown>,
): CaaTuple | null {
  if (typeof input === "string") {
    const m = input.trim().match(/^(\d+)\s+([a-z0-9]+)\s+"?([^"]*)"?\s*$/i);
    if (!m) return null;
    return {
      flags: Number(m[1]),
      tag: m[2]!.toLowerCase(),
      value: m[3]!.trim().toLowerCase(),
    };
  }
  const flags = Number((input as { critical?: unknown }).critical ?? 0);
  for (const tag of ["issue", "issuewild", "iodef", "contactemail", "contactphone"]) {
    const v = input[tag];
    if (typeof v === "string") {
      return { flags, tag, value: v.trim().toLowerCase() };
    }
  }
  return null;
}

export function caaEqual(a: CaaTuple | null, b: CaaTuple | null): boolean {
  return (
    a !== null &&
    b !== null &&
    a.flags === b.flags &&
    a.tag === b.tag &&
    a.value === b.value
  );
}

export function caaToString(t: CaaTuple): string {
  return `${t.flags} ${t.tag} "${t.value}"`;
}

function mxHost(content: string): string {
  // "10 mail.example.com." → "mail.example.com"
  const parts = content.trim().split(/\s+/);
  const host = parts.length > 1 ? parts[1]! : parts[0]!;
  return host.replace(/\.$/, "").toLowerCase();
}

/**
 * Pick the existing record that the expected one should overwrite, or undefined
 * to create a fresh record. Exact content always wins; otherwise identity is
 * matched per type so we never repurpose an unrelated record.
 */
export function chooseExisting(
  expected: ExpectedRecord,
  existing: ProviderRecord[],
): ProviderRecord | undefined {
  const exact = existing.find((e) => strip(e.content) === strip(expected.content));
  if (exact) return exact;

  if (expected.type === "TXT") {
    const kind = txtKind(expected.content);
    if (!kind) return undefined;
    return existing.find((e) => txtKind(e.content) === kind);
  }
  if (expected.type === "MX") {
    const host = mxHost(expected.content);
    return existing.find((e) => mxHost(e.content) === host);
  }
  if (expected.type === "CAA") {
    // CAA can legitimately have several records at the apex; only replace an
    // exact match (handled above), else create.
    return undefined;
  }
  // CNAME/A: the name is purpose-specific (autoconfig.<domain>, …), so a single
  // existing record at that name is ours to update.
  return existing[0];
}

/**
 * Records that duplicate the expected one and should be deleted after the
 * chosen record is written. Only TXT duplicates of the same kind are removed —
 * enough to fix a double SPF/DKIM without deleting anything unmanaged.
 */
export function staleDuplicates(
  expected: ExpectedRecord,
  existing: ProviderRecord[],
  chosen: ProviderRecord | undefined,
): ProviderRecord[] {
  if (expected.type !== "TXT") return [];
  const kind = txtKind(expected.content);
  if (!kind) return [];
  return existing.filter(
    (e) => txtKind(e.content) === kind && e.id !== chosen?.id,
  );
}
