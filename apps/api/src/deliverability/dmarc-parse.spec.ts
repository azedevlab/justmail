import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  decompressReport,
  parseDmarcArchive,
  parseDmarcReport,
} from "./dmarc-parse";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feedback>
  <report_metadata>
    <org_name>google.com</org_name>
    <email>noreply-dmarc-support@google.com</email>
    <report_id>18004207223045</report_id>
    <date_range>
      <begin>1706054400</begin>
      <end>1706140800</end>
    </date_range>
  </report_metadata>
  <policy_published>
    <domain>example.com</domain>
    <p>reject</p>
  </policy_published>
  <record>
    <row>
      <source_ip>203.0.113.10</source_ip>
      <count>7</count>
      <policy_evaluated>
        <disposition>none</disposition>
        <dkim>pass</dkim>
        <spf>pass</spf>
      </policy_evaluated>
    </row>
    <identifiers>
      <header_from>example.com</header_from>
    </identifiers>
  </record>
  <record>
    <row>
      <source_ip>198.51.100.4</source_ip>
      <count>3</count>
      <policy_evaluated>
        <disposition>quarantine</disposition>
        <dkim>fail</dkim>
        <spf>fail</spf>
      </policy_evaluated>
    </row>
    <identifiers>
      <header_from>example.com</header_from>
    </identifiers>
  </record>
</feedback>`;

describe("parseDmarcReport", () => {
  it("extracts report metadata", () => {
    const r = parseDmarcReport(SAMPLE);
    expect(r.reporter).toBe("google.com");
    expect(r.domain).toBe("example.com");
    expect(r.report_id).toBe("18004207223045");
    expect(r.begin_ts).toBe(new Date(1706054400 * 1000).toISOString());
    expect(r.end_ts).toBe(new Date(1706140800 * 1000).toISOString());
  });

  it("aggregates pass/fail by DKIM-or-SPF alignment", () => {
    const r = parseDmarcReport(SAMPLE);
    expect(r.pass).toBe(7);
    expect(r.fail).toBe(3);
  });

  it("captures per-source drilldown rows", () => {
    const r = parseDmarcReport(SAMPLE);
    expect(r.records).toHaveLength(2);
    const [first, second] = r.records;
    expect(first).toMatchObject({
      source_ip: "203.0.113.10",
      count: 7,
      disposition: "none",
      dkim_pass: true,
      spf_pass: true,
      header_from: "example.com",
    });
    expect(second).toMatchObject({
      source_ip: "198.51.100.4",
      count: 3,
      disposition: "quarantine",
      dkim_pass: false,
      spf_pass: false,
    });
  });

  it("normalises a single record into an array", () => {
    const single = SAMPLE.replace(/<record>[\s\S]*<\/feedback>/, "")
      .concat(`  <record>
      <row>
        <source_ip>192.0.2.1</source_ip>
        <count>1</count>
        <policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>fail</spf></policy_evaluated>
      </row>
    </record>
</feedback>`);
    const r = parseDmarcReport(single);
    expect(r.records).toHaveLength(1);
    expect(r.pass).toBe(1);
  });
});

describe("decompressReport", () => {
  it("passes through plain XML", () => {
    expect(decompressReport(Buffer.from(SAMPLE)).trim()).toContain("<feedback>");
  });

  it("decompresses gzip archives", () => {
    const out = decompressReport(gzipSync(Buffer.from(SAMPLE)));
    expect(out).toContain("example.com");
  });

  it("parses a gzip archive end to end", () => {
    const r = parseDmarcArchive(gzipSync(Buffer.from(SAMPLE)));
    expect(r.pass).toBe(7);
    expect(r.records).toHaveLength(2);
  });
});
