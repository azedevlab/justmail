import { z } from "zod";
import { Email, IsoDate, Uuid } from "./primitives.js";

export const OrgRole = z.enum(["owner", "admin", "member", "viewer"]);
export type OrgRole = z.infer<typeof OrgRole>;

export const AuthStatus = z.object({
  bootstrapped: z.boolean(),
  passkeys_supported: z.boolean(),
  sso_providers: z.array(
    z.object({
      id: Uuid,
      name: z.string(),
      kind: z.enum(["oidc", "saml"]),
    }),
  ),
});
export type AuthStatus = z.infer<typeof AuthStatus>;

export const BootstrapRequest = z.object({
  email: Email,
  password: z.string().min(12).max(256),
  name: z.string().min(1).max(200),
  org_name: z.string().min(1).max(200),
});
export type BootstrapRequest = z.infer<typeof BootstrapRequest>;

export const LoginRequest = z.object({
  email: Email,
  password: z.string().min(1).max(256),
  totp_code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const PasskeyChallenge = z.object({
  challenge: z.string(),
  timeout_ms: z.number().int(),
  rp_id: z.string(),
});
export type PasskeyChallenge = z.infer<typeof PasskeyChallenge>;

// The WebAuthn ceremony JSON is produced/consumed by @simplewebauthn on both
// ends; it is validated cryptographically by the server, so the transport
// schema only needs to carry it through opaquely.
export const PasskeyRegisterVerifyRequest = z.object({
  name: z.string().min(1).max(100),
  response: z.unknown(),
});
export type PasskeyRegisterVerifyRequest = z.infer<
  typeof PasskeyRegisterVerifyRequest
>;

export const PasskeyAuthOptionsRequest = z.object({ email: Email });
export type PasskeyAuthOptionsRequest = z.infer<
  typeof PasskeyAuthOptionsRequest
>;

export const PasskeyAuthVerifyRequest = z.object({
  challenge_id: Uuid,
  response: z.unknown(),
});
export type PasskeyAuthVerifyRequest = z.infer<typeof PasskeyAuthVerifyRequest>;

export const PasskeyAuthOptionsResponse = z.object({
  challenge_id: Uuid,
  options: z.unknown(),
});
export type PasskeyAuthOptionsResponse = z.infer<
  typeof PasskeyAuthOptionsResponse
>;

export const PasskeyInfo = z.object({
  id: Uuid,
  name: z.string(),
  device_type: z.string().nullable(),
  backed_up: z.boolean(),
  created_at: IsoDate,
  last_used_at: IsoDate.nullable(),
});
export type PasskeyInfo = z.infer<typeof PasskeyInfo>;

export const SessionOrg = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  role: OrgRole,
});
export type SessionOrg = z.infer<typeof SessionOrg>;

export const Me = z.object({
  id: Uuid,
  email: Email,
  name: z.string(),
  totp_enabled: z.boolean(),
  passkey_enabled: z.boolean(),
  orgs: z.array(SessionOrg),
});
export type Me = z.infer<typeof Me>;

export const SessionInfo = z.object({
  id: Uuid,
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  device_fingerprint: z.string().nullable(),
  created_at: IsoDate,
  expires_at: IsoDate,
  last_seen_at: IsoDate,
  current: z.boolean(),
});
export type SessionInfo = z.infer<typeof SessionInfo>;

export const TwoFaSetupResponse = z.object({
  secret: z.string(),
  otpauth_url: z.string(),
  recovery_codes: z.array(z.string()).optional(),
});
export type TwoFaSetupResponse = z.infer<typeof TwoFaSetupResponse>;

export const TwoFaVerifyRequest = z.object({
  totp_code: z.string().regex(/^\d{6}$/),
});
export type TwoFaVerifyRequest = z.infer<typeof TwoFaVerifyRequest>;

export const TwoFaDisableRequest = z.object({
  password: z.string().min(1).max(256),
});
export type TwoFaDisableRequest = z.infer<typeof TwoFaDisableRequest>;

export const WsTicket = z.object({
  ticket: z.string(),
  expires_at: IsoDate,
});
export type WsTicket = z.infer<typeof WsTicket>;
