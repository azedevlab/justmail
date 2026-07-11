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

// The RP ID must be a registrable domain suffix shared by *every* browser
// origin that authenticates with passkeys. Admin and webmail live on sibling
// subdomains (e.g. app.example.com + webmail.example.com), so a single host is
// wrong — the shared parent (example.com) is required. Derive it from the
// configured hosts' longest common label-suffix unless pinned explicitly.
export function commonDomainSuffix(hosts: string[]): string | undefined {
  const labels = hosts.map((h) => h.split(".").reverse());
  if (labels.length === 0) return undefined;
  if (labels.length === 1) return hosts[0];
  const common: string[] = [];
  for (let i = 0; labels[0]![i] !== undefined; i++) {
    const label = labels[0]![i]!;
    if (!labels.every((l) => l[i] === label)) break;
    common.push(label);
  }
  // Two labels minimum so we never return a bare public suffix (e.g. "com").
  return common.length >= 2 ? common.reverse().join(".") : undefined;
}

export function rpId(): string {
  if (config.WEBAUTHN_RP_ID) return config.WEBAUTHN_RP_ID;
  const hosts = [config.JM_ADMIN_HOST, config.JM_WEBMAIL_HOST].filter(
    (h): h is string => !!h,
  );
  return commonDomainSuffix(hosts) ?? config.JM_WEB_HOST ?? "localhost";
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
