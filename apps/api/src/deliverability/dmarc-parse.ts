import { gunzipSync, inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

// One evaluated row from a DMARC aggregate report: a source IP and the
// message count it sent, with the policy's DKIM/SPF alignment verdicts.
export interface DmarcParsedRecord {
  source_ip: string;
  count: number;
  disposition: string;
  dkim_pass: boolean;
  spf_pass: boolean;
  header_from: string | null;
}

export interface DmarcParsed {
  report_id: string | null;
  reporter: string;
  domain: string;
  begin_ts: string;
  end_ts: string;
  // Message counts aggregated across rows. A row is DMARC-aligned (pass) when
  // either DKIM or SPF evaluated to pass; everything else counts as fail.
  pass: number;
  fail: number;
  records: DmarcParsedRecord[];
}

// Aggregate reports arrive gzip'd (.xml.gz) or zip'd (.zip), occasionally plain
// XML. Detect by magic bytes and decompress to a UTF-8 XML string.
export function decompressReport(input: Buffer): string {
  if (input.length >= 2 && input[0] === 0x1f && input[1] === 0x8b) {
    return gunzipSync(input).toString("utf8");
  }
  if (
    input.length >= 4 &&
    input[0] === 0x50 &&
    input[1] === 0x4b &&
    input[2] === 0x03 &&
    input[3] === 0x04
  ) {
    return unzipSingle(input);
  }
  return input.toString("utf8");
}

// Minimal single-entry ZIP reader: DMARC report archives contain exactly one
// XML file. Reads the local file header, then STOREs verbatim or INFLATEs.
function unzipSingle(buf: Buffer): string {
  const method = buf.readUInt16LE(8);
  const compressedSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;
  // Streamed archives write 0 here and defer sizes to a trailing descriptor;
  // fall back to the remainder of the buffer (zlib stops at the stream end).
  const data =
    compressedSize > 0
      ? buf.subarray(dataStart, dataStart + compressedSize)
      : buf.subarray(dataStart);
  if (method === 0) return data.toString("utf8");
  if (method === 8) return inflateRawSync(data).toString("utf8");
  throw new Error(`Unsupported ZIP compression method ${method}`);
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function epochToIso(v: unknown): string {
  const secs = Number(v);
  if (!Number.isFinite(secs)) return new Date(0).toISOString();
  return new Date(secs * 1000).toISOString();
}

export function parseDmarcReport(xml: string): DmarcParsed {
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  const feedback = (doc.feedback ?? {}) as Record<string, unknown>;
  const meta = (feedback.report_metadata ?? {}) as Record<string, unknown>;
  const dateRange = (meta.date_range ?? {}) as Record<string, unknown>;
  const policy = (feedback.policy_published ?? {}) as Record<string, unknown>;

  const reporter =
    String(meta.org_name ?? meta.email ?? "").trim() || "unknown";
  const domain = String(policy.domain ?? "").trim();
  const reportId = meta.report_id != null ? String(meta.report_id) : null;

  const records: DmarcParsedRecord[] = [];
  let pass = 0;
  let fail = 0;
  for (const rec of toArray<Record<string, unknown>>(
    feedback.record as Record<string, unknown> | Record<string, unknown>[],
  )) {
    const row = (rec.row ?? {}) as Record<string, unknown>;
    const evaluated = (row.policy_evaluated ?? {}) as Record<string, unknown>;
    const identifiers = (rec.identifiers ?? {}) as Record<string, unknown>;
    const count = Math.max(0, Math.trunc(Number(row.count) || 0));
    const dkimPass = String(evaluated.dkim ?? "").toLowerCase() === "pass";
    const spfPass = String(evaluated.spf ?? "").toLowerCase() === "pass";
    const aligned = dkimPass || spfPass;
    if (aligned) pass += count;
    else fail += count;
    records.push({
      source_ip: String(row.source_ip ?? "").trim(),
      count,
      disposition: String(evaluated.disposition ?? "none").toLowerCase(),
      dkim_pass: dkimPass,
      spf_pass: spfPass,
      header_from: identifiers.header_from
        ? String(identifiers.header_from).trim()
        : null,
    });
  }

  return {
    report_id: reportId,
    reporter,
    domain,
    begin_ts: epochToIso(dateRange.begin),
    end_ts: epochToIso(dateRange.end),
    pass,
    fail,
    records,
  };
}

// Decompress (if needed) and parse in one step.
export function parseDmarcArchive(input: Buffer): DmarcParsed {
  return parseDmarcReport(decompressReport(input));
}
