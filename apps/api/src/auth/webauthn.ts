import { config } from "../config";

// @simplewebauthn/server is ESM-only; the API is CommonJS. A cached dynamic
// import keeps it usable without converting the whole build, and confines the
// security-critical WebAuthn verification to a vetted library.
function loadSw() {
  return import("@simplewebauthn/server");
}
let mod: ReturnType<typeof loadSw> | null = null;
function sw(): ReturnType<typeof loadSw> {
  if (!mod) mod = loadSw();
  return mod;
}

// RP ID must be a registrable suffix shared by every browser origin (admin +
// webmail live on sibling subdomains, so this is the parent cookie domain).
export function rpId(): string {
  return config.WEBAUTHN_RP_ID ?? config.JM_WEB_HOST ?? "localhost";
}

export function expectedOrigins(): string[] {
  if (config.WEBAUTHN_ORIGINS) {
    return config.WEBAUTHN_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const hosts = [
    config.JM_ADMIN_HOST,
    config.JM_WEBMAIL_HOST,
    config.JM_WEB_HOST,
  ].filter((h): h is string => !!h);
  if (hosts.length > 0) return hosts.map((h) => `https://${h}`);
  // Dev fallback: the local app dev servers.
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ];
}

export interface StoredCredential {
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
}

type AuthenticatorTransport = "ble" | "hybrid" | "internal" | "nfc" | "usb";

export async function registrationOptions(params: {
  userId: string;
  userName: string;
  userDisplayName: string;
  existing: StoredCredential[];
}) {
  const { generateRegistrationOptions } = await sw();
  return generateRegistrationOptions({
    rpName: config.WEBAUTHN_RP_NAME,
    rpID: rpId(),
    userID: new TextEncoder().encode(params.userId),
    userName: params.userName,
    userDisplayName: params.userDisplayName,
    attestationType: "none",
    excludeCredentials: params.existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });
}

export async function verifyRegistration(params: {
  response: unknown;
  expectedChallenge: string;
}) {
  const { verifyRegistrationResponse } = await sw();
  return verifyRegistrationResponse({
    response: params.response as Parameters<
      typeof verifyRegistrationResponse
    >[0]["response"],
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: expectedOrigins(),
    expectedRPID: rpId(),
    requireUserVerification: false,
  });
}

export async function authenticationOptions(params: {
  allow: StoredCredential[];
}) {
  const { generateAuthenticationOptions } = await sw();
  return generateAuthenticationOptions({
    rpID: rpId(),
    allowCredentials: params.allow.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransport[],
    })),
    userVerification: "preferred",
  });
}

export async function verifyAuthentication(params: {
  response: unknown;
  expectedChallenge: string;
  credential: StoredCredential;
}) {
  const { verifyAuthenticationResponse } = await sw();
  return verifyAuthenticationResponse({
    response: params.response as Parameters<
      typeof verifyAuthenticationResponse
    >[0]["response"],
    expectedChallenge: params.expectedChallenge,
    expectedOrigin: expectedOrigins(),
    expectedRPID: rpId(),
    credential: {
      id: params.credential.credentialId,
      publicKey: new Uint8Array(params.credential.publicKey),
      counter: params.credential.counter,
      transports: params.credential.transports as AuthenticatorTransport[],
    },
    requireUserVerification: false,
  });
}
