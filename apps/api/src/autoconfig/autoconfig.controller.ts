import { Controller, Get, Header, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { config } from "../config";

/**
 * Mail-client auto-configuration. Clients discover server settings so the user
 * only types their address and password — never a hostname or port.
 *
 * Traefik routes autoconfig.* and autodiscover.* hosts here (see compose
 * labels), and DNS publishes those names as CNAMEs per hosted domain.
 *
 *  - Thunderbird / GNOME / K-9: GET autoconfig.<domain>/mail/config-v1.1.xml
 *  - Outlook / eM Client:       POST autodiscover.<domain>/autodiscover/autodiscover.xml
 *
 * All hosted domains share one mail host (config.MAIL_HOSTNAME) with IMAPS on
 * 993 and submission on 587 (STARTTLS), so a single template serves everyone.
 */
@Controller()
export class AutoconfigController {
  private readonly imapHost = config.MAIL_HOSTNAME;
  private readonly smtpHost = config.MAIL_HOSTNAME;
  private readonly brand = config.WEBAUTHN_RP_NAME;

  @Get("mail/config-v1.1.xml")
  @Header("content-type", "application/xml; charset=utf-8")
  @Header("cache-control", "public, max-age=3600")
  mozilla(
    @Query("emailaddress") emailaddress: string | undefined,
    @Req() req: Request,
  ): string {
    const domain = this.domainFor(emailaddress, req);
    return this.mozillaXml(domain);
  }

  // Thunderbird also probes the address domain directly at this well-known path.
  @Get(".well-known/autoconfig/mail/config-v1.1.xml")
  @Header("content-type", "application/xml; charset=utf-8")
  @Header("cache-control", "public, max-age=3600")
  mozillaWellKnown(
    @Query("emailaddress") emailaddress: string | undefined,
    @Req() req: Request,
  ): string {
    return this.mozillaXml(this.domainFor(emailaddress, req));
  }

  @Post("autodiscover/autodiscover.xml")
  @Header("content-type", "application/xml; charset=utf-8")
  autodiscover(@Req() req: Request): string {
    const email = this.emailFromAutodiscover(req);
    return this.autodiscoverXml(email);
  }

  // Some clients probe with GET before POSTing the request document.
  @Get("autodiscover/autodiscover.xml")
  @Header("content-type", "application/xml; charset=utf-8")
  autodiscoverGet(@Req() req: Request): string {
    const email = this.emailFromAutodiscover(req);
    return this.autodiscoverXml(email);
  }

  private domainFor(email: string | undefined, req: Request): string {
    const fromEmail = email?.includes("@")
      ? email.split("@")[1]!.toLowerCase()
      : "";
    if (fromEmail) return fromEmail;
    // Fall back to the requested host with the autoconfig/autodiscover label
    // stripped (e.g. autoconfig.example.com → example.com).
    return (req.hostname ?? "")
      .toLowerCase()
      .replace(/^(autoconfig|autodiscover)\./, "");
  }

  private emailFromAutodiscover(req: Request): string {
    const body = typeof req.body === "string" ? req.body : "";
    const match = body.match(/<EMailAddress>\s*([^<]+?)\s*<\/EMailAddress>/i);
    const email = match?.[1]?.trim().toLowerCase() ?? "";
    if (email.includes("@")) return email;
    const domain = (req.hostname ?? "")
      .toLowerCase()
      .replace(/^autodiscover\./, "");
    return domain ? `%EMAILADDRESS%@${domain}` : "%EMAILADDRESS%";
  }

  private mozillaXml(domain: string): string {
    const provider = esc(domain || this.imapHost);
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<clientConfig version="1.1">',
      `  <emailProvider id="${provider}">`,
      `    <domain>${provider}</domain>`,
      `    <displayName>${esc(this.brand)}</displayName>`,
      `    <displayShortName>${esc(this.brand)}</displayShortName>`,
      '    <incomingServer type="imap">',
      `      <hostname>${esc(this.imapHost)}</hostname>`,
      "      <port>993</port>",
      "      <socketType>SSL</socketType>",
      "      <authentication>password-cleartext</authentication>",
      "      <username>%EMAILADDRESS%</username>",
      "    </incomingServer>",
      '    <outgoingServer type="smtp">',
      `      <hostname>${esc(this.smtpHost)}</hostname>`,
      "      <port>587</port>",
      "      <socketType>STARTTLS</socketType>",
      "      <authentication>password-cleartext</authentication>",
      "      <username>%EMAILADDRESS%</username>",
      "    </outgoingServer>",
      "  </emailProvider>",
      "</clientConfig>",
      "",
    ].join("\n");
  }

  private autodiscoverXml(loginName: string): string {
    const login = esc(loginName);
    const protocol = (type: "IMAP" | "SMTP", port: number, enc: string) =>
      [
        "      <Protocol>",
        `        <Type>${type}</Type>`,
        `        <Server>${esc(type === "IMAP" ? this.imapHost : this.smtpHost)}</Server>`,
        `        <Port>${port}</Port>`,
        `        <LoginName>${login}</LoginName>`,
        "        <SSL>on</SSL>",
        `        <Encryption>${enc}</Encryption>`,
        "        <SPA>off</SPA>",
        "        <AuthRequired>on</AuthRequired>",
        "      </Protocol>",
      ].join("\n");
    return [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">',
      '  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">',
      "    <Account>",
      "      <AccountType>email</AccountType>",
      "      <Action>settings</Action>",
      protocol("IMAP", 993, "SSL"),
      protocol("SMTP", 587, "TLS"),
      "    </Account>",
      "  </Response>",
      "</Autodiscover>",
      "",
    ].join("\n");
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
