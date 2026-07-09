import { Injectable, Logger } from "@nestjs/common";
import { resolve4, resolveTxt } from "node:dns/promises";
import { networkInterfaces } from "node:os";
import { Db } from "../db/db.service";

// The stable set of DNSBLs we check the sending IP against. Add/remove via
// settings in a follow-up so operators can trust their own sources.
const DNSBLS = [
  "zen.spamhaus.org",
  "bl.spamcop.net",
  "b.barracudacentral.org",
  "cbl.abuseat.org",
];

@Injectable()
export class DnsblService {
  private readonly logger = new Logger(DnsblService.name);

  constructor(private readonly db: Db) {}

  async tick() {
    const ip = firstPublicIpv4();
    if (!ip) return;
    const reversed = ip.split(".").reverse().join(".");
    for (const bl of DNSBLS) {
      let hit = false;
      try {
        await resolve4(`${reversed}.${bl}`);
        hit = true;
      } catch {
        hit = false;
      }
      let evidence: string | null = null;
      if (hit) {
        try {
          const txt = await resolveTxt(`${reversed}.${bl}`);
          evidence = txt.map((c) => c.join("")).join(" | ");
        } catch {
          evidence = null;
        }
      }
      await this.db.query(
        `INSERT INTO dnsbl_checks (ip, bl, hit) VALUES ($1::inet, $2, $3)`,
        [ip, bl, hit],
      );
      if (hit) {
        await this.db.query(
          `INSERT INTO mail_events (event, direction, from_addr, detail)
           VALUES ('dnsbl.hit', 'outbound', $1, $2)`,
          [ip, `${bl}: ${evidence ?? "listed"}`],
        );
      }
    }
    // Trim old check rows to keep the table lean.
    await this.db.query(
      "DELETE FROM dnsbl_checks WHERE checked_at < now() - interval '30 days'",
    );
    this.logger.debug?.(`dnsbl check complete for ${ip}`);
  }
}

function firstPublicIpv4(): string | null {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] ?? []) {
      if (info.family !== "IPv4" || info.internal) continue;
      if (/^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(info.address)) continue;
      return info.address;
    }
  }
  return null;
}
