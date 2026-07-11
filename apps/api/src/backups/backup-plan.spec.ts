import { describe, expect, it } from "vitest";
import {
  isDue,
  nextRun,
  pgEnvFromUrl,
  retentionCutoff,
  sha256,
} from "./backup-plan";

describe("nextRun", () => {
  const base = new Date("2026-03-10T02:00:00.000Z");
  it("advances a day for daily", () => {
    expect(nextRun(base, "daily").toISOString()).toBe("2026-03-11T02:00:00.000Z");
  });
  it("advances a week for weekly", () => {
    expect(nextRun(base, "weekly").toISOString()).toBe("2026-03-17T02:00:00.000Z");
  });
  it("advances a month for monthly", () => {
    expect(nextRun(base, "monthly").toISOString()).toBe("2026-04-10T02:00:00.000Z");
  });
});

describe("isDue", () => {
  const now = new Date("2026-03-10T02:00:00.000Z");
  it("is false when disabled", () => {
    expect(isDue({ enabled: false, next_run_at: null }, now)).toBe(false);
  });
  it("is true when never run", () => {
    expect(isDue({ enabled: true, next_run_at: null }, now)).toBe(true);
  });
  it("is true when next run is in the past", () => {
    expect(
      isDue({ enabled: true, next_run_at: new Date(now.getTime() - 1000) }, now),
    ).toBe(true);
  });
  it("is false when next run is in the future", () => {
    expect(
      isDue({ enabled: true, next_run_at: new Date(now.getTime() + 1000) }, now),
    ).toBe(false);
  });
});

describe("retentionCutoff", () => {
  it("subtracts whole days", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    expect(retentionCutoff(now, 7).toISOString()).toBe("2026-03-03T00:00:00.000Z");
  });
});

describe("sha256", () => {
  it("hashes bytes deterministically", () => {
    expect(sha256(Buffer.from("justmail"))).toBe(
      sha256(Buffer.from("justmail")),
    );
    expect(sha256(Buffer.from(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("pgEnvFromUrl", () => {
  it("maps host, port, db, and credentials", () => {
    const { env, database } = pgEnvFromUrl(
      "postgres://justmail:s3cr3t@db.internal:5433/justmail?sslmode=require",
    );
    expect(database).toBe("justmail");
    expect(env.PGHOST).toBe("db.internal");
    expect(env.PGPORT).toBe("5433");
    expect(env.PGUSER).toBe("justmail");
    expect(env.PGPASSWORD).toBe("s3cr3t");
    expect(env.PGSSLMODE).toBe("require");
  });
  it("decodes percent-encoded credentials and defaults the port", () => {
    const { env } = pgEnvFromUrl("postgres://u%40corp:p%3Aw@host/appdb");
    expect(env.PGUSER).toBe("u@corp");
    expect(env.PGPASSWORD).toBe("p:w");
    expect(env.PGPORT).toBe("5432");
  });
});
