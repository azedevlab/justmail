import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
} from "node:crypto";
import { buildAuthUrl, pkcePair, verifyIdToken } from "./oidc";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key" };

function makeIdToken(claims: Record<string, unknown>): string {
  const header = { alg: "RS256", typ: "JWT", kid: "test-key" };
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(claims)}`;
  const sig = cryptoSign(
    "sha256",
    Buffer.from(signingInput),
    privateKey,
  ).toString("base64url");
  return `${signingInput}.${sig}`;
}

function stubJwks() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ keys: [jwk] }),
    })),
  );
}

const base = () => ({
  jwksUri: "https://idp.example.com/jwks",
  issuer: "https://idp.example.com",
  clientId: "client-123",
  nonce: "n-abc",
});

afterEach(() => vi.unstubAllGlobals());

describe("pkcePair", () => {
  it("derives an S256 challenge from the verifier", () => {
    const { verifier, challenge } = pkcePair();
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
    expect(verifier).not.toContain("=");
  });
});

describe("buildAuthUrl", () => {
  it("sets the code flow + PKCE params", () => {
    const url = new URL(
      buildAuthUrl({
        authorizationEndpoint: "https://idp.example.com/authorize",
        clientId: "client-123",
        redirectUri: "https://api.example.com/v1/auth/sso/x/callback",
        scopes: ["openid", "email"],
        state: "s1",
        nonce: "n1",
        codeChallenge: "cc",
      }),
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("openid email");
    expect(url.searchParams.get("client_id")).toBe("client-123");
  });
});

describe("verifyIdToken", () => {
  const now = Math.floor(Date.now() / 1000);

  it("accepts a valid RS256 token", async () => {
    stubJwks();
    const token = makeIdToken({
      iss: "https://idp.example.com",
      aud: "client-123",
      sub: "user-1",
      email: "alice@example.com",
      nonce: "n-abc",
      exp: now + 300,
      iat: now,
    });
    const claims = await verifyIdToken({ idToken: token, ...base() });
    expect(claims.sub).toBe("user-1");
    expect(claims.email).toBe("alice@example.com");
  });

  it("rejects a mismatched nonce", async () => {
    stubJwks();
    const token = makeIdToken({
      iss: "https://idp.example.com",
      aud: "client-123",
      sub: "user-1",
      nonce: "wrong",
      exp: now + 300,
    });
    await expect(verifyIdToken({ idToken: token, ...base() })).rejects.toThrow(
      /nonce/,
    );
  });

  it("rejects a wrong audience", async () => {
    stubJwks();
    const token = makeIdToken({
      iss: "https://idp.example.com",
      aud: "someone-else",
      sub: "user-1",
      nonce: "n-abc",
      exp: now + 300,
    });
    await expect(verifyIdToken({ idToken: token, ...base() })).rejects.toThrow(
      /audience/,
    );
  });

  it("rejects an expired token", async () => {
    stubJwks();
    const token = makeIdToken({
      iss: "https://idp.example.com",
      aud: "client-123",
      sub: "user-1",
      nonce: "n-abc",
      exp: now - 3600,
    });
    await expect(verifyIdToken({ idToken: token, ...base() })).rejects.toThrow(
      /expired/,
    );
  });

  it("rejects a tampered signature", async () => {
    stubJwks();
    const token = makeIdToken({
      iss: "https://idp.example.com",
      aud: "client-123",
      sub: "user-1",
      nonce: "n-abc",
      exp: now + 300,
    });
    const tampered = token.slice(0, -4) + "AAAA";
    await expect(
      verifyIdToken({ idToken: tampered, ...base() }),
    ).rejects.toThrow();
  });
});
