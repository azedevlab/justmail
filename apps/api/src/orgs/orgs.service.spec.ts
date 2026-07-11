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
