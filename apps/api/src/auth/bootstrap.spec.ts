import { afterEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { config } from "../config";
import type { BootstrapRequest } from "@justmail/contracts";

const REQ: BootstrapRequest = {
  email: "owner@example.test",
  password: "correct horse battery",
  name: "Owner",
  org_name: "Acme",
};

// A db mock whose tx() runs the callback against a query stub that answers the
// bootstrap statements by SQL text. `userCount` sets what the in-lock count of
// users returns.
function dbMock(userCount: number) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("count(*) AS n FROM users")) {
      return { rows: [{ n: String(userCount) }] };
    }
    if (sql.includes("INSERT INTO organizations")) return { rows: [{ id: "org-1" }] };
    if (sql.includes("INSERT INTO users")) return { rows: [{ id: "user-1" }] };
    if (sql.includes("INSERT INTO sessions")) return { rows: [{ id: "sess-1" }] };
    return { rows: [] };
  });
  const db = {
    query,
    tx: async (fn: (tx: { query: typeof query }) => unknown) => fn({ query }),
  };
  return { db, query };
}

function svc(userCount = 0) {
  const { db, query } = dbMock(userCount);
  const audit = { log: vi.fn() };
  const service = new AuthService(
    db as never,
    audit as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, query, audit };
}

afterEach(() => {
  delete (config as { BOOTSTRAP_TOKEN?: string }).BOOTSTRAP_TOKEN;
});

describe("AuthService.bootstrap token gate", () => {
  it("rejects bootstrap without the token when one is configured", async () => {
    (config as { BOOTSTRAP_TOKEN?: string }).BOOTSTRAP_TOKEN =
      "super-secret-bootstrap-token";
    const { service, query } = svc();
    await expect(service.bootstrap(REQ)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // Fails before any DB work.
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects a wrong token", async () => {
    (config as { BOOTSTRAP_TOKEN?: string }).BOOTSTRAP_TOKEN =
      "super-secret-bootstrap-token";
    const { service } = svc();
    await expect(
      service.bootstrap(REQ, undefined, undefined, "nope"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("proceeds with the correct token", async () => {
    (config as { BOOTSTRAP_TOKEN?: string }).BOOTSTRAP_TOKEN =
      "super-secret-bootstrap-token";
    const { service, query } = svc();
    await expect(
      service.bootstrap(REQ, undefined, undefined, "super-secret-bootstrap-token"),
    ).resolves.toMatchObject({ sessionId: "sess-1" });
    expect(query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock($1)", [
      expect.any(Number),
    ]);
  });

  it("does not require a token in non-production when none is configured", async () => {
    const { service } = svc();
    await expect(service.bootstrap(REQ)).resolves.toMatchObject({
      sessionId: "sess-1",
    });
  });
});

describe("AuthService.bootstrap atomic guard", () => {
  it("takes the advisory lock and rejects if users already exist", async () => {
    const { service, query } = svc(1);
    await expect(service.bootstrap(REQ)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock($1)", [
      expect.any(Number),
    ]);
  });
});
