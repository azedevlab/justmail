import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { Db } from "../db/db.service";
import { AuditService } from "../audit/audit.service";
import { OrgsService } from "../orgs/orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

const SETTING = "security.country_block";
const WARMUP = "delivery.ip_warmup";

export const CountryBlockSetting = z.object({
  enabled: z.boolean(),
  countries: z.array(z.string().length(2)).max(250),
});
export type CountryBlockSetting = z.infer<typeof CountryBlockSetting>;

export const IpWarmupSetting = z.object({
  enabled: z.boolean(),
  started_at: z.string(),
  days: z.number().int().min(1).max(90).default(30),
  daily_limit_start: z.number().int().min(1).max(1_000_000).default(50),
  daily_limit_target: z.number().int().min(1).max(10_000_000).default(50_000),
});
export type IpWarmupSetting = z.infer<typeof IpWarmupSetting>;

@Injectable()
export class GeoblockService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
    private readonly audit: AuditService,
  ) {}

  async readCountryBlock(orgId: string, userId: string): Promise<CountryBlockSetting> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{ value: CountryBlockSetting }>(
      "SELECT value FROM settings WHERE key = $1",
      [`org:${orgId}.${SETTING}`],
    );
    return rows[0]?.value ?? { enabled: false, countries: [] };
  }

  async writeCountryBlock(
    principal: SessionPrincipal,
    orgId: string,
    value: CountryBlockSetting,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    const key = `org:${orgId}.${SETTING}`;
    await this.db.query(
      `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value), principal.userId],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "security.country_block.update",
      ip,
      meta: value,
    });
    return value;
  }

  async readWarmup(orgId: string, userId: string): Promise<IpWarmupSetting | null> {
    await this.orgs.requireRole(orgId, userId, "viewer");
    const { rows } = await this.db.query<{ value: IpWarmupSetting }>(
      "SELECT value FROM settings WHERE key = $1",
      [`org:${orgId}.${WARMUP}`],
    );
    return rows[0]?.value ?? null;
  }

  async writeWarmup(
    principal: SessionPrincipal,
    orgId: string,
    value: IpWarmupSetting,
    ip?: string,
  ) {
    await this.orgs.requireRole(orgId, principal.userId, "admin");
    await this.db.query(
      `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [`org:${orgId}.${WARMUP}`, JSON.stringify(value), principal.userId],
    );
    this.audit.log({
      orgId,
      actorType: "user",
      actorId: principal.userId,
      action: "delivery.ip_warmup.update",
      ip,
      meta: value,
    });
    return value;
  }
}
