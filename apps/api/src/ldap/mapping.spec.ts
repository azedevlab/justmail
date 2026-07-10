import { describe, expect, it } from "vitest";
import {
  escapeFilterValue,
  expandGroups,
  mapEntry,
  resolveRole,
} from "./mapping";

const cfg = {
  emailAttribute: "mail",
  nameAttribute: "displayName",
  uidAttribute: "sAMAccountName",
  memberAttribute: "memberOf",
};

describe("escapeFilterValue", () => {
  it("escapes RFC 4515 special characters", () => {
    expect(escapeFilterValue("a*b(c)\\d")).toBe("a\\2ab\\28c\\29\\5cd");
  });
});

describe("mapEntry", () => {
  it("lowercases email and dn, keeps display name, collects groups", () => {
    const user = mapEntry(
      {
        dn: "CN=Alice,OU=Staff,DC=example,DC=com",
        mail: "Alice@Example.com",
        displayName: "Alice Doe",
        sAMAccountName: "alice",
        memberOf: ["CN=Admins,DC=example,DC=com", "CN=Staff,DC=example,DC=com"],
      },
      cfg,
    );
    expect(user.email).toBe("alice@example.com");
    expect(user.name).toBe("Alice Doe");
    expect(user.uid).toBe("alice");
    expect(user.externalId).toBe("cn=alice,ou=staff,dc=example,dc=com");
    expect(user.groups).toEqual([
      "cn=admins,dc=example,dc=com",
      "cn=staff,dc=example,dc=com",
    ]);
  });

  it("tolerates a single string membership and missing email", () => {
    const user = mapEntry(
      { dn: "cn=bob", displayName: "Bob", memberOf: "CN=Staff" },
      cfg,
    );
    expect(user.email).toBeNull();
    expect(user.groups).toEqual(["cn=staff"]);
  });
});

describe("expandGroups", () => {
  it("follows nested group-of-group links transitively", () => {
    const parents = new Map<string, string[]>([
      ["cn=engineers,dc=x", ["cn=staff,dc=x"]],
      ["cn=staff,dc=x", ["cn=everyone,dc=x"]],
    ]);
    const groups = expandGroups(["CN=Engineers,DC=x"], parents);
    expect(groups).toContain("cn=engineers,dc=x");
    expect(groups).toContain("cn=staff,dc=x");
    expect(groups).toContain("cn=everyone,dc=x");
  });

  it("does not loop on cyclic membership", () => {
    const parents = new Map<string, string[]>([
      ["cn=a", ["cn=b"]],
      ["cn=b", ["cn=a"]],
    ]);
    expect(expandGroups(["cn=a"], parents).sort()).toEqual(["cn=a", "cn=b"]);
  });
});

describe("resolveRole", () => {
  const map = {
    "CN=Admins,DC=x": "admin" as const,
    "CN=Owners,DC=x": "owner" as const,
  };
  it("picks the highest-ranked matching group", () => {
    expect(
      resolveRole(["cn=admins,dc=x", "cn=owners,dc=x"], map, "member"),
    ).toBe("owner");
  });
  it("falls back to the default role when nothing matches", () => {
    expect(resolveRole(["cn=nobody,dc=x"], map, "viewer")).toBe("viewer");
  });
});
