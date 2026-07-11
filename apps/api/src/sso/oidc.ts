import {
  createHash,
  createPublicKey,
  randomBytes,
  verify as cryptoVerify,
  type JsonWebKeyInput,
  type KeyObject,
} from "node:crypto";
import { config } from "../config";

// Newer @types/node dropped the top-level JsonWebKey re-export from
// `node:crypto`. Derive the exact JWK shape `createPublicKey` expects from
// JsonWebKeyInput, which resolves on both the old and new typings.
type JsonWebKey = JsonWebKeyInput["key"];

// Minimal OpenID Connect authorization-code (+ PKCE) client. Discovery documents
// and JWKS are fetched over TLS and cached briefly. id_token signatures are
// verified against the issuer's published keys — no third-party dependency.

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

export interface OidcClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  [claim: string]: unknown;
}

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const DISCOVERY_TTL_MS = config.OIDC_METADATA_CACHE_TTL_SECONDS * 1_000;
const JWKS_TTL_MS = config.OIDC_METADATA_CACHE_TTL_SECONDS * 1_000;
const HTTP_TIMEOUT_MS = config.OIDC_HTTP_TIMEOUT_SECONDS * 1_000;

const discoveryCache = new Map<string, CacheEntry<OidcDiscovery>>();
const jwksCache = new Map<string, CacheEntry<JsonWebKey[]>>();

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`OIDC request to ${url} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function discover(issuer: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(issuer);
  if (cached && cached.expires > Date.now()) return cached.value;
  const base = issuer.replace(/\/$/, "");
  const doc = await fetchJson<OidcDiscovery>(
    `${base}/.well-known/openid-configuration`,
  );
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error("OIDC discovery document is missing required endpoints");
  }
  discoveryCache.set(issuer, {
    value: doc,
    expires: Date.now() + DISCOVERY_TTL_MS,
  });
  return doc;
}

export function buildAuthUrl(params: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes.join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  id_token?: string;
  access_token?: string;
  token_type?: string;
}

export async function exchangeCode(params: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };
  // Confidential clients authenticate with HTTP Basic; public clients rely on
  // PKCE alone.
  if (params.clientSecret) {
    const basic = Buffer.from(
      `${encodeURIComponent(params.clientId)}:${encodeURIComponent(params.clientSecret)}`,
    ).toString("base64");
    headers.authorization = `Basic ${basic}`;
  }
  return fetchJson<TokenResponse>(params.tokenEndpoint, {
    method: "POST",
    headers,
    body: body.toString(),
  });
}

async function resolveKey(jwksUri: string, kid?: string): Promise<KeyObject> {
  const load = async (force: boolean): Promise<JsonWebKey[]> => {
    const cached = jwksCache.get(jwksUri);
    if (!force && cached && cached.expires > Date.now()) return cached.value;
    const doc = await fetchJson<{ keys: JsonWebKey[] }>(jwksUri);
    const keys = doc.keys ?? [];
    jwksCache.set(jwksUri, { value: keys, expires: Date.now() + JWKS_TTL_MS });
    return keys;
  };

  const pick = (keys: JsonWebKey[]): JsonWebKey | undefined =>
    (kid ? keys.find((k) => (k as { kid?: string }).kid === kid) : keys[0]) ??
    keys[0];

  let key = pick(await load(false));
  // A rotated key may not be cached yet — refetch once before giving up.
  if (!key) key = pick(await load(true));
  if (!key) throw new Error("no matching JWKS key for id_token");
  return createPublicKey({ key, format: "jwk" });
}

function b64urlToJson<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

const RS_HASH: Record<string, string> = {
  RS256: "sha256",
  RS384: "sha384",
  RS512: "sha512",
};
const ES_HASH: Record<string, string> = {
  ES256: "sha256",
  ES384: "sha384",
  ES512: "sha512",
};

// Verify an id_token and return its claims. Checks the signature against the
// issuer JWKS plus iss / aud / exp / iat and the login nonce.
export async function verifyIdToken(params: {
  idToken: string;
  jwksUri: string;
  issuer: string;
  clientId: string;
  nonce: string;
  clockSkewSec?: number;
}): Promise<OidcClaims> {
  const parts = params.idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const header = b64urlToJson<{ alg: string; kid?: string }>(headerB64);
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(sigB64, "base64url");
  const key = await resolveKey(params.jwksUri, header.kid);

  let ok = false;
  if (RS_HASH[header.alg]) {
    ok = cryptoVerify(RS_HASH[header.alg], signingInput, key, signature);
  } else if (ES_HASH[header.alg]) {
    ok = cryptoVerify(
      ES_HASH[header.alg],
      signingInput,
      { key, dsaEncoding: "ieee-p1363" },
      signature,
    );
  } else {
    throw new Error(`unsupported id_token alg: ${header.alg}`);
  }
  if (!ok) throw new Error("id_token signature verification failed");

  const claims = b64urlToJson<OidcClaims & { iss?: string; aud?: string | string[]; exp?: number; iat?: number }>(
    payloadB64,
  );
  const skew = params.clockSkewSec ?? 60;
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== params.issuer) throw new Error("id_token issuer mismatch");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(params.clientId)) throw new Error("id_token audience mismatch");
  if (typeof claims.exp === "number" && claims.exp + skew < now) {
    throw new Error("id_token expired");
  }
  if (typeof claims.iat === "number" && claims.iat - skew > now) {
    throw new Error("id_token issued in the future");
  }
  if (claims.nonce !== params.nonce) throw new Error("id_token nonce mismatch");
  if (!claims.sub) throw new Error("id_token missing sub");

  return claims;
}
