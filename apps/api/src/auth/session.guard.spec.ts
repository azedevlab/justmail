import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { SessionGuard } from "./session.guard";
import { ADMIN_SESSION_COOKIE as SESSION_COOKIE } from "./session-cookie";
import type { AuthService, SessionPrincipal } from "./auth.service";
import type { ApiKeysService } from "../apikeys/apikeys.service";

const principal: SessionPrincipal = {
  userId: "user-1",
  email: "admin@example.test",
  name: "Admin",
  sessionId: "session-1",
};

function ctxFor(req: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as Parameters<SessionGuard["canActivate"]>[0];
}

function guardResolving(validToken: string) {
  const auth = {
    resolveSession: vi.fn(async (t: string) =>
      t === validToken ? principal : null,
    ),
  } as unknown as AuthService & {
    resolveSession: ReturnType<typeof vi.fn>;
  };
  const apiKeys = { resolve: vi.fn() } as unknown as ApiKeysService;
  return { guard: new SessionGuard(auth, apiKeys), auth };
}

describe("SessionGuard duplicate-cookie resilience", () => {
  it("authenticates via a valid jm_session even when a stale duplicate is surfaced first", async () => {
    const { guard, auth } = guardResolving("GOOD");
    // cookie-parser surfaces only the first (stale) value; the good token lives
    // later in the raw header.
    const req = {
      cookies: { [SESSION_COOKIE]: "STALE" },
      headers: { cookie: `${SESSION_COOKIE}=STALE; ${SESSION_COOKIE}=GOOD` },
    } as unknown as { principal?: SessionPrincipal };

    await expect(guard.canActivate(ctxFor(req))).resolves.toBe(true);
    expect(req.principal).toBe(principal);
    expect(auth.resolveSession).toHaveBeenCalledWith("STALE");
    expect(auth.resolveSession).toHaveBeenCalledWith("GOOD");
  });

  it("401s when no jm_session value resolves and there is no bearer token", async () => {
    const { guard } = guardResolving("GOOD");
    const req = {
      cookies: { [SESSION_COOKIE]: "STALE" },
      headers: { cookie: `${SESSION_COOKIE}=STALE` },
    };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("caps how many session tokens it will try", async () => {
    const { guard, auth } = guardResolving("NEVER");
    const cookie = Array.from(
      { length: 12 },
      (_, i) => `${SESSION_COOKIE}=t${i}`,
    ).join("; ");
    const req = { cookies: {}, headers: { cookie } };
    await expect(guard.canActivate(ctxFor(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(auth.resolveSession.mock.calls.length).toBeLessThanOrEqual(5);
  });
});
