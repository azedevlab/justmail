import { describe, expect, it } from "vitest";
import { ScimGroupBody, ScimPatchBody, ScimUserBody } from "./scim.schemas";

describe("SCIM envelope validation", () => {
  it("passes provider-specific attributes through untouched", () => {
    const parsed = ScimUserBody.parse({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: "jane@example.com",
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
        department: "eng",
      },
    });
    expect(parsed.userName).toBe("jane@example.com");
    expect(
      parsed["urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"],
    ).toEqual({ department: "eng" });
  });

  it("rejects a wrong-typed core field", () => {
    expect(ScimUserBody.safeParse({ userName: 42 }).success).toBe(false);
  });

  it("defaults Operations to an empty array and rejects a non-array", () => {
    expect(ScimPatchBody.parse({}).Operations).toEqual([]);
    expect(ScimPatchBody.safeParse({ Operations: "nope" }).success).toBe(false);
  });

  it("requires an op string on each patch operation", () => {
    expect(
      ScimPatchBody.safeParse({ Operations: [{ path: "active" }] }).success,
    ).toBe(false);
    expect(
      ScimPatchBody.safeParse({
        Operations: [{ op: "replace", path: "active", value: false }],
      }).success,
    ).toBe(true);
  });

  it("accepts a group with members and passthrough fields", () => {
    const parsed = ScimGroupBody.parse({
      displayName: "Engineers",
      members: [{ value: "user-1", display: "Jane" }],
    });
    expect(parsed.displayName).toBe("Engineers");
    expect(parsed.members).toHaveLength(1);
  });
});
