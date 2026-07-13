import { describe, expect, it } from "vitest";
import {
  chooseExisting,
  staleDuplicates,
  txtKind,
  type ProviderRecord,
} from "./dns-reconcile";

const rec = (over: Partial<ProviderRecord>): ProviderRecord => ({
  id: "id",
  type: "TXT",
  name: "example.com",
  content: "",
  ttl: 3600,
  ...over,
});

describe("txtKind", () => {
  it("classifies managed TXT schemes", () => {
    expect(txtKind("v=spf1 mx ~all")).toBe("v=spf1");
    expect(txtKind('"v=DMARC1; p=none"')).toBe("v=dmarc1");
    expect(txtKind("v=DKIM1; k=rsa; p=AAAA")).toBe("v=dkim1");
    expect(txtKind("justmail-verify=abc")).toBe("justmail-verify");
  });

  it("returns null for unmanaged TXT (e.g. site verification)", () => {
    expect(txtKind("google-site-verification=xyz")).toBeNull();
    expect(txtKind("some random note")).toBeNull();
  });
});

describe("chooseExisting", () => {
  it("never clobbers an unrelated TXT when creating SPF", () => {
    const existing = [rec({ id: "g", content: "google-site-verification=xyz" })];
    const chosen = chooseExisting(
      { type: "TXT", name: "example.com", content: "v=spf1 mx ~all" },
      existing,
    );
    expect(chosen).toBeUndefined();
  });

  it("updates the existing SPF record even when its content differs", () => {
    const existing = [
      rec({ id: "g", content: "google-site-verification=xyz" }),
      rec({ id: "spf", content: "v=spf1 include:old.example ~all" }),
    ];
    const chosen = chooseExisting(
      { type: "TXT", name: "example.com", content: "v=spf1 mx ~all" },
      existing,
    );
    expect(chosen?.id).toBe("spf");
  });

  it("matches MX by exchange host regardless of priority", () => {
    const existing = [
      rec({ id: "mx", type: "MX", content: "20 mail.example.com.", priority: 20 }),
    ];
    const chosen = chooseExisting(
      { type: "MX", name: "example.com", content: "mail.example.com" },
      existing,
    );
    expect(chosen?.id).toBe("mx");
  });

  it("prefers an exact content match", () => {
    const existing = [
      rec({ id: "a", content: "v=spf1 include:old ~all" }),
      rec({ id: "b", content: "v=spf1 mx ~all" }),
    ];
    const chosen = chooseExisting(
      { type: "TXT", name: "example.com", content: "v=spf1 mx ~all" },
      existing,
    );
    expect(chosen?.id).toBe("b");
  });
});

describe("staleDuplicates", () => {
  it("returns the extra same-kind TXT records to delete", () => {
    const existing = [
      rec({ id: "spf1", content: "v=spf1 mx ~all" }),
      rec({ id: "spf2", content: "v=spf1 include:old ~all" }),
      rec({ id: "g", content: "google-site-verification=xyz" }),
    ];
    const dups = staleDuplicates(
      { type: "TXT", name: "example.com", content: "v=spf1 mx ~all" },
      existing,
      rec({ id: "spf1", content: "v=spf1 mx ~all" }),
    );
    expect(dups.map((d) => d.id)).toEqual(["spf2"]);
  });

  it("never lists unmanaged TXT as stale", () => {
    const existing = [rec({ id: "g", content: "google-site-verification=xyz" })];
    const dups = staleDuplicates(
      { type: "TXT", name: "example.com", content: "v=spf1 mx ~all" },
      existing,
      undefined,
    );
    expect(dups).toEqual([]);
  });
});
