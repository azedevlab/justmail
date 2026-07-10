import { describe, expect, it } from "vitest";
import { memberFromPath, memberValues, parseEqFilter } from "./scim.service";

describe("parseEqFilter", () => {
  it("parses userName eq filters", () => {
    expect(parseEqFilter('userName eq "alice@example.com"')).toEqual({
      attr: "userName",
      value: "alice@example.com",
    });
  });
  it("returns null for unsupported filters", () => {
    expect(parseEqFilter("userName sw \"a\"")).toBeNull();
    expect(parseEqFilter(undefined)).toBeNull();
  });
});

describe("memberValues", () => {
  it("extracts values from an array of member objects", () => {
    expect(memberValues([{ value: "a" }, { value: "b" }])).toEqual(["a", "b"]);
  });
  it("handles a single object and plain strings", () => {
    expect(memberValues({ value: "x" })).toEqual(["x"]);
    expect(memberValues(["y", "z"])).toEqual(["y", "z"]);
  });
});

describe("memberFromPath", () => {
  it("pulls the id out of a filtered members path", () => {
    expect(memberFromPath('members[value eq "abc-123"]')).toEqual(["abc-123"]);
  });
  it("returns null when there is no filter", () => {
    expect(memberFromPath("members")).toBeNull();
    expect(memberFromPath(undefined)).toBeNull();
  });
});
