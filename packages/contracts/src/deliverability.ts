import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";

export const DmarcReport = z.object({
  id: Uuid,
  reporter: z.string(),
  begin_ts: IsoDate,
  end_ts: IsoDate,
  pass: z.number().int(),
  fail: z.number().int(),
  created_at: IsoDate,
  domain_name: z.string().nullable(),
});
export type DmarcReport = z.infer<typeof DmarcReport>;

export const DmarcRecord = z.object({
  source_ip: z.string(),
  count: z.number().int(),
  disposition: z.string(),
  dkim_pass: z.boolean(),
  spf_pass: z.boolean(),
  header_from: z.string().nullable(),
});
export type DmarcRecord = z.infer<typeof DmarcRecord>;

export const DmarcReportDetail = DmarcReport.extend({
  records: z.array(DmarcRecord),
});
export type DmarcReportDetail = z.infer<typeof DmarcReportDetail>;

export const ReputationDay = z.object({
  day: z.string(),
  sent: z.number().int(),
  bounced: z.number().int(),
  complained: z.number().int(),
  deferred: z.number().int(),
});
export type ReputationDay = z.infer<typeof ReputationDay>;

export const DnsblResult = z.object({
  bl: z.string(),
  hit: z.boolean(),
  checked_at: IsoDate,
});
export type DnsblResult = z.infer<typeof DnsblResult>;
