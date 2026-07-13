import { describe, expect, it, vi } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrgsService } from "./orgs.service";
import type { SessionPrincipal } from "../auth/auth.service";

function svcWith(memberRole: string | null) {
  const query = vi.fn(async () => ({
    rows: memberRole ? [{ role: memberRole }] : [],
  }));
  const svc = new OrgsService({ query } as never, {} as never);
  return { svc, query };
}

const mailboxPrincipal = (orgId: string | null): SessionPrincipal => ({
  userId: "user-1",
  email: "user@example.test",
  name: "User",
  sessionId: "s-1",
  mailboxId: "mb-1",
  orgId,
});

// Queues query results in order: org_members lookup first (empty for API-key
// principals), then the api_keys lookup.
function svcWithApiKey(keyRow: { org_id: string; scopes: string[] } | null) {
  const responses = [{ rows: [] as unknown[] }, { rows: keyRow ? [keyRow] : [] }];
  let i = 0;
  const query = vi.fn(async () => responses[Math.min(i++, responses.length - 1)]);
  const svc = new OrgsService({ query } as never, {} as never);
  return { svc, query };
}

describe("OrgsService.requireRole (API-key scopes)", () => {
  it("caps a read-only key at viewer — no admin/write", async () => {
    const { svc } = svcWithApiKey({ org_id: "org-1", scopes: ["read"] });
    await expect(svc.requireRole("org-1", "key-1", "viewer")).resolves.toBe(
      "viewer",
    );
    const denied = svcWithApiKey({ org_id: "org-1", scopes: ["read"] });
    await expect(
      denied.svc.requireRole("org-1", "key-1", "admin"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("grants a write key member level but not admin", async () => {
    const { svc } = svcWithApiKey({ org_id: "org-1", scopes: ["write"] });
    await expect(svc.requireRole("org-1", "key-1", "member")).resolves.toBe(
      "member",
    );
    const denied = svcWithApiKey({ org_id: "org-1", scopes: ["write"] });
    await expect(
      denied.svc.requireRole("org-1", "key-1", "admin"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("grants an admin-scoped key admin level", async () => {
    const { svc } = svcWithApiKey({ org_id: "org-1", scopes: ["admin"] });
    await expect(svc.requireRole("org-1", "key-1", "admin")).resolves.toBe(
      "admin",
    );
  });

  it("treats an unscoped key as full access (backward compatible)", async () => {
    const { svc } = svcWithApiKey({ org_id: "org-1", scopes: [] });
    await expect(svc.requireRole("org-1", "key-1", "admin")).resolves.toBe(
      "admin",
    );
  });

  it("rejects a key issued for a different org", async () => {
    const { svc } = svcWithApiKey({ org_id: "org-2", scopes: ["admin"] });
    await expect(
      svc.requireRole("org-1", "key-1", "viewer"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("OrgsService.requireOrgAccess", () => {
  it("authorizes a mailbox session for its own org without an org_members row", async () => {
    const { svc, query } = svcWith(null);
    await expect(
      svc.requireOrgAccess(mailboxPrincipal("org-1"), "org-1", "member"),
    ).resolves.toBeUndefined();
    // The mailbox branch never falls through to the org_members lookup.
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects a mailbox session reaching for a different org", async () => {
    const { svc } = svcWith(null);
    await expect(
      svc.requireOrgAccess(mailboxPrincipal("org-1"), "org-2", "member"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("caps a mailbox session at member level (no admin actions)", async () => {
    const { svc } = svcWith(null);
    await expect(
      svc.requireOrgAccess(mailboxPrincipal("org-1"), "org-1", "admin"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("falls back to the org_members check for console sessions", async () => {
    const { svc, query } = svcWith("owner");
    const consolePrincipal: SessionPrincipal = {
      userId: "admin-1",
      email: "admin@example.test",
      name: "Admin",
      sessionId: "s-2",
    };
    await expect(
      svc.requireOrgAccess(consolePrincipal, "org-1", "member"),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalled();
  });
});
