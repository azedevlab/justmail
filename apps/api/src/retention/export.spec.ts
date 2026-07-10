import { describe, expect, it } from "vitest";
import { escapeMbox } from "./export.service";

describe("escapeMbox", () => {
  it("prefixes a body line starting with From_", () => {
    const out = escapeMbox(Buffer.from("hi\nFrom the desk\nbye")).toString("latin1");
    expect(out).toBe("hi\n>From the desk\nbye");
  });

  it("adds one more > to already-escaped From_ lines", () => {
    const out = escapeMbox(Buffer.from(">From x\n>>From y")).toString("latin1");
    expect(out).toBe(">>From x\n>>>From y");
  });

  it("leaves ordinary lines untouched", () => {
    const out = escapeMbox(Buffer.from("Subject: Fromage\nFromm")).toString("latin1");
    expect(out).toBe("Subject: Fromage\nFromm");
  });
});
