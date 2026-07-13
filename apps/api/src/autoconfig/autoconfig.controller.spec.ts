import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { AutoconfigController } from "./autoconfig.controller";

const ctrl = new AutoconfigController();

function req(partial: Partial<Request>): Request {
  return { hostname: "", body: "", ...partial } as Request;
}

describe("AutoconfigController Mozilla config", () => {
  it("advertises IMAPS 993 and submission 587 for the address domain", () => {
    const xml = ctrl.mozilla("alice@example.com", req({}));
    expect(xml).toContain('<emailProvider id="example.com">');
    expect(xml).toContain("<domain>example.com</domain>");
    expect(xml).toMatch(/<incomingServer type="imap">[\s\S]*<port>993<\/port>/);
    expect(xml).toContain("<socketType>SSL</socketType>");
    expect(xml).toMatch(/<outgoingServer type="smtp">[\s\S]*<port>587<\/port>/);
    expect(xml).toContain("<socketType>STARTTLS</socketType>");
    expect(xml).toContain("<username>%EMAILADDRESS%</username>");
  });

  it("falls back to the request host when no address is supplied", () => {
    const xml = ctrl.mozilla(undefined, req({ hostname: "autoconfig.acme.test" }));
    expect(xml).toContain("<domain>acme.test</domain>");
  });
});

describe("AutoconfigController Outlook autodiscover", () => {
  it("reads the login name from the posted request document", () => {
    const body = `<?xml version="1.0"?><Autodiscover><Request>
      <EMailAddress>bob@example.com</EMailAddress>
    </Request></Autodiscover>`;
    const xml = ctrl.autodiscover(req({ body }));
    expect(xml).toContain("<LoginName>bob@example.com</LoginName>");
    expect(xml).toMatch(/<Type>IMAP<\/Type>[\s\S]*<Port>993<\/Port>/);
    expect(xml).toMatch(/<Type>SMTP<\/Type>[\s\S]*<Port>587<\/Port>/);
  });

  it("escapes XML metacharacters in the login name", () => {
    const body = "<EMailAddress>a&b@x.test</EMailAddress>";
    const xml = ctrl.autodiscover(req({ body }));
    expect(xml).toContain("a&amp;b@x.test");
    expect(xml).not.toContain("a&b@x.test");
  });
});
