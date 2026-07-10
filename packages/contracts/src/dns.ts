import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const DnsPurpose = z.enum([
  "mx",
  "spf",
  "dkim",
  "dmarc",
  "verification",
  "mta_sts",
  "tls_rpt",
  "autoconfig",
  "autodiscover",
  "bimi",
  "caa",
  "dane",
  "custom",
]);
export type DnsPurpose = z.infer<typeof DnsPurpose>;

export const DnsCheckStatus = z.enum([
  "unknown",
  "pending",
  "propagating",
  "ok",
  "drifted",
  "missing",
  "error",
]);
export type DnsCheckStatus = z.infer<typeof DnsCheckStatus>;

export const DnsRecord = z.object({
  id: Uuid,
  purpose: DnsPurpose,
  type: z.string(),
  name: z.string(),
  content: z.string(),
  ttl: z.number().int(),
  priority: z.number().int().nullable(),
  observed_content: z.string().nullable(),
  check_status: DnsCheckStatus,
  last_checked_at: IsoDate.nullable(),
});
export type DnsRecord = z.infer<typeof DnsRecord>;

export const DnsSyncResult = z.object({
  applied: z.array(
    z.object({
      purpose: DnsPurpose,
      action: z.enum(["kept", "upserted", "deleted", "error"]),
      detail: z.string().optional(),
    }),
  ),
});
export type DnsSyncResult = z.infer<typeof DnsSyncResult>;

export const DomainVerifyResponse = z.object({
  status: z.enum(["pending_verification", "verifying", "active"]),
  records: z.array(DnsRecord),
});
export type DomainVerifyResponse = z.infer<typeof DomainVerifyResponse>;
