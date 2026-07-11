import { describe, expect, it } from "vitest";
import { toZoneFile, type ZoneRecord } from "./dns.service";

describe("toZoneFile", () => {
  const domain = "example.com";

  it("fully-qualifies owner names and MX/CNAME targets", () => {
    const records: ZoneRecord[] = [
      { type: "MX", name: "example.com", content: "mail.mailhost.net", ttl: 3600, priority: 10 },
      { type: "CNAME", name: "autoconfig.example.com", content: "autoconfig.mailhost.net", ttl: 3600 },
    ];
    const zone = toZoneFile(domain, records);
    expect(zone).toContain("example.com.\t3600\tIN\tMX\t10 mail.mailhost.net.");
    expect(zone).toContain("autoconfig.example.com.\t3600\tIN\tCNAME\tautoconfig.mailhost.net.");
  });

  it("quotes TXT rdata", () => {
    const records: ZoneRecord[] = [
      { type: "TXT", name: "example.com", content: "v=spf1 mx ~all", ttl: 3600 },
    ];
    expect(toZoneFile(domain, records)).toContain(
      'example.com.\t3600\tIN\tTXT\t"v=spf1 mx ~all"',
    );
  });

  it("splits long TXT values into 255-byte quoted strings", () => {
    const long = "k=".padEnd(300, "a");
    const zone = toZoneFile(domain, [
      { type: "TXT", name: "sel._domainkey.example.com", content: long, ttl: 3600 },
    ]);
    const rdata = zone
      .split("\n")
      .find((l) => l.includes("_domainkey"))!
      .split("\tTXT\t")[1]!;
    const parts = rdata.match(/"(?:[^"\\]|\\.)*"/g)!;
    expect(parts).toHaveLength(2);
    expect(parts[0]!.length - 2).toBeLessThanOrEqual(255);
  });

  it("emits CAA rdata verbatim", () => {
    const zone = toZoneFile(domain, [
      { type: "CAA", name: "example.com", content: '0 issue "letsencrypt.org"', ttl: 3600 },
    ]);
    expect(zone).toContain('example.com.\t3600\tIN\tCAA\t0 issue "letsencrypt.org"');
  });

  it("preserves an already-qualified owner name", () => {
    const zone = toZoneFile(domain, [
      { type: "TXT", name: "_dmarc.example.com.", content: "v=DMARC1; p=none", ttl: 300 },
    ]);
    expect(zone).toContain("_dmarc.example.com.\t300\tIN\tTXT");
    expect(zone).not.toContain("example.com..");
  });
});
