import { describe, expect, it } from "vitest";
import { compileRule, compileScript, type CompilableRule } from "./sieve-compile";

const rule = (over: Partial<CompilableRule>): CompilableRule => ({
  name: "Rule",
  match: "all",
  conditions: [],
  actions: [{ type: "keep" }],
  ...over,
});

describe("compileRule", () => {
  it("emits an unconditional block when there are no conditions", () => {
    const out = compileRule(rule({ name: "Catch all", actions: [{ type: "keep" }] }));
    expect(out).toBe("# Catch all\n  keep;");
  });

  it("emits a single header test without allof/anyof", () => {
    const out = compileRule(
      rule({
        conditions: [{ field: "from", op: "contains", value: "boss@x.com" }],
        actions: [{ type: "fileinto", arg: "Work" }],
      }),
    );
    expect(out).toContain('if header :contains ["from"] "boss@x.com" {');
    expect(out).toContain("  fileinto \"Work\";");
    expect(out).not.toContain("allof");
  });

  it("wraps multiple conditions in allof for match=all", () => {
    const out = compileRule(
      rule({
        match: "all",
        conditions: [
          { field: "from", op: "is", value: "a@x.com" },
          { field: "subject", op: "contains", value: "urgent" },
        ],
      }),
    );
    expect(out).toContain(
      'if allof (header :is ["from"] "a@x.com", header :contains ["subject"] "urgent") {',
    );
  });

  it("wraps multiple conditions in anyof for match=any", () => {
    const out = compileRule(
      rule({
        match: "any",
        conditions: [
          { field: "to", op: "contains", value: "a@x.com" },
          { field: "cc", op: "contains", value: "b@x.com" },
        ],
      }),
    );
    expect(out).toContain("if anyof (");
  });

  it("expands the any pseudo-field to common headers", () => {
    const out = compileRule(
      rule({ conditions: [{ field: "any", op: "contains", value: "sale" }] }),
    );
    expect(out).toContain('["from", "to", "cc", "subject"]');
  });

  it("compiles each action type", () => {
    expect(compileRule(rule({ actions: [{ type: "discard" }] }))).toContain("discard;");
    expect(compileRule(rule({ actions: [{ type: "stop" }] }))).toContain("stop;");
    expect(compileRule(rule({ actions: [{ type: "seen" }] }))).toContain('addflag "\\\\Seen";');
    expect(
      compileRule(rule({ actions: [{ type: "flag", arg: "\\Flagged" }] })),
    ).toContain('addflag "\\\\Flagged";');
    expect(
      compileRule(rule({ actions: [{ type: "redirect", arg: "x@y.com" }] })),
    ).toContain('redirect "x@y.com";');
  });

  it("escapes quotes and backslashes in values", () => {
    const out = compileRule(
      rule({ conditions: [{ field: "subject", op: "is", value: 'a"b\\c' }] }),
    );
    expect(out).toContain('"a\\"b\\\\c"');
  });
});

describe("compileScript", () => {
  it("emits a require line only for the extensions actually used", () => {
    const out = compileScript([
      rule({ actions: [{ type: "fileinto", arg: "Work" }] }),
      rule({ actions: [{ type: "seen" }] }),
    ]);
    expect(out).toContain('require ["fileinto", "imap4flags"];');
  });

  it("omits require when no extension is needed", () => {
    const out = compileScript([rule({ actions: [{ type: "keep" }] })]);
    expect(out).not.toContain("require");
  });

  it("concatenates rules in the given order", () => {
    const out = compileScript([
      rule({ name: "First", actions: [{ type: "keep" }] }),
      rule({ name: "Second", actions: [{ type: "stop" }] }),
    ]);
    expect(out.indexOf("# First")).toBeLessThan(out.indexOf("# Second"));
  });
});
