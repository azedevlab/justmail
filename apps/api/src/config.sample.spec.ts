import { describe, expect, it } from "vitest";
import { buildEnvSample } from "./config.sample";

describe("buildEnvSample", () => {
  const sample = buildEnvSample();

  it("lists required keys (no default) uncommented under Required", () => {
    const required = sample.slice(
      sample.indexOf("── Required"),
      sample.indexOf("── Optional"),
    );
    expect(required).toMatch(/^DATABASE_URL=/m);
    expect(required).toMatch(/^ENCRYPTION_KEY=/m);
    expect(required).toMatch(/^EVENTS_INGEST_TOKEN=/m);
  });

  it("emits defaulted keys commented out with their default value", () => {
    expect(sample).toMatch(/^# PORT=4000\b/m);
    expect(sample).toMatch(/^# NODE_ENV=development\b/m);
    expect(sample).toMatch(/^# DNS_PROVIDER=cloudflare\b/m);
  });

  it("annotates enum keys with their allowed values", () => {
    expect(sample).toMatch(/DNS_PROVIDER=.*one of: cloudflare, route53, desec, none/);
  });

  it("keeps optional-no-default keys commented with an empty value", () => {
    expect(sample).toMatch(/^# CLOUDFLARE_API_TOKEN=\s/m);
  });
});
