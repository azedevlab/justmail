import { SAML } from "@node-saml/node-saml";
import type { SamlConfig } from "@justmail/contracts";

// Normalise a certificate to bare base64 (node-saml accepts PEM or base64, but
// we strip the PEM armour and whitespace to be forgiving of pasted values).
function normalizeCert(cert: string): string {
  return cert
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");
}

export interface SamlEndpoints {
  spEntityId: string; // SP EntityID / issuer
  acsUrl: string; // Assertion Consumer Service (POST binding)
}

function build(cfg: SamlConfig, sp: SamlEndpoints): SAML {
  return new SAML({
    callbackUrl: sp.acsUrl,
    entryPoint: cfg.entry_point,
    issuer: sp.spEntityId,
    idpCert: normalizeCert(cfg.idp_cert),
    audience: sp.spEntityId,
    identifierFormat:
      "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    signatureAlgorithm: cfg.signature_algorithm,
    wantAssertionsSigned: cfg.want_assertions_signed,
    wantAuthnResponseSigned: false,
    validateInResponseTo: "never" as never,
    acceptedClockSkewMs: 5000,
  });
}

export async function samlAuthorizeUrl(
  cfg: SamlConfig,
  sp: SamlEndpoints,
  relayState: string,
): Promise<string> {
  const saml = build(cfg, sp);
  return saml.getAuthorizeUrlAsync(relayState, undefined, {});
}

export interface SamlProfileResult {
  subject: string;
  email?: string;
  name?: string;
  issuer?: string;
}

export async function samlValidateResponse(
  cfg: SamlConfig,
  sp: SamlEndpoints,
  samlResponse: string,
): Promise<SamlProfileResult> {
  const saml = build(cfg, sp);
  const { profile } = await saml.validatePostResponseAsync({
    SAMLResponse: samlResponse,
  });
  if (!profile) throw new Error("SAML response contained no profile");

  const attrs = (profile.attributes ?? {}) as Record<string, unknown>;
  const first = (v: unknown): string | undefined =>
    Array.isArray(v) ? (v[0] as string | undefined) : (v as string | undefined);

  const email =
    first(attrs[cfg.email_attribute]) ??
    (typeof profile.nameID === "string" && profile.nameID.includes("@")
      ? profile.nameID
      : undefined);
  const name = first(attrs[cfg.name_attribute]);
  const subject = profile.nameID ?? email;
  if (!subject) throw new Error("SAML assertion has no NameID or email");

  return { subject, email, name, issuer: profile.issuer };
}

export function samlMetadata(cfg: SamlConfig, sp: SamlEndpoints): string {
  const saml = build(cfg, sp);
  return saml.generateServiceProviderMetadata(null, null);
}
