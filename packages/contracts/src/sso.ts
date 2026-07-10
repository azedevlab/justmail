import { z } from "zod";
import { IsoDate, Uuid } from "./primitives.js";
import { OrgRole } from "./auth.js";

export const SsoKind = z.enum(["oidc", "saml"]);
export type SsoKind = z.infer<typeof SsoKind>;

// OIDC provider. `issuer` must expose /.well-known/openid-configuration; the
// authorization-code flow with PKCE is used against the discovered endpoints.
export const OidcConfig = z.object({
  issuer: z.string().url(),
  client_id: z.string().min(1).max(320),
  scopes: z
    .array(z.string().min(1).max(64))
    .max(16)
    .default(["openid", "email", "profile"]),
  email_claim: z.string().min(1).max(64).default("email"),
  name_claim: z.string().min(1).max(64).default("name"),
});
export type OidcConfig = z.infer<typeof OidcConfig>;

// SAML 2.0 provider. `entry_point` is the IdP SSO URL; `idp_cert` is the IdP's
// signing certificate (PEM or bare base64) used to verify assertion signatures.
export const SamlConfig = z.object({
  entry_point: z.string().url(),
  idp_issuer: z.string().min(1).max(1024),
  idp_cert: z.string().min(1).max(20000),
  email_attribute: z.string().min(1).max(128).default("email"),
  name_attribute: z.string().min(1).max(128).default("displayName"),
  want_assertions_signed: z.boolean().default(true),
  signature_algorithm: z.enum(["sha256", "sha512"]).default("sha256"),
});
export type SamlConfig = z.infer<typeof SamlConfig>;

const routing = {
  name: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  email_domain: z.string().max(253).optional(),
  auto_provision: z.boolean().default(true),
  default_role: OrgRole.default("member"),
};

export const SsoProviderRequest = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("oidc"),
    ...routing,
    oidc: OidcConfig,
    // Omit on update to keep the stored secret; empty string clears it.
    client_secret: z.string().max(4096).optional(),
  }),
  z.object({
    kind: z.literal("saml"),
    ...routing,
    saml: SamlConfig,
  }),
]);
export type SsoProviderRequest = z.infer<typeof SsoProviderRequest>;

// Full provider view for the admin console. Includes the SP endpoints the admin
// registers at the IdP. Secrets are never returned — only `has_secret`.
export const SsoProvider = z.object({
  id: Uuid,
  org_id: Uuid,
  kind: SsoKind,
  name: z.string(),
  enabled: z.boolean(),
  email_domain: z.string().nullable(),
  auto_provision: z.boolean(),
  default_role: OrgRole,
  oidc: OidcConfig.nullable(),
  saml: SamlConfig.nullable(),
  has_secret: z.boolean(),
  login_url: z.string().url(),
  callback_url: z.string().url(),
  acs_url: z.string().url(),
  metadata_url: z.string().url(),
  created_at: IsoDate,
  updated_at: IsoDate,
});
export type SsoProvider = z.infer<typeof SsoProvider>;

// Login-page discovery: given an email, resolve the provider to redirect to.
export const SsoDiscovery = z.object({
  provider_id: Uuid,
  kind: SsoKind,
  name: z.string(),
  login_url: z.string().url(),
});
export type SsoDiscovery = z.infer<typeof SsoDiscovery>;

export const SsoDiscoveryResult = z.object({
  provider: SsoDiscovery.nullable(),
});
export type SsoDiscoveryResult = z.infer<typeof SsoDiscoveryResult>;
