import { describe, expect, it } from "vitest";
import { buildSearchCriteria, SearchRequest } from "./webmail.service";

const parse = (q: string, extra: Record<string, unknown> = {}) =>
  buildSearchCriteria(SearchRequest.parse({ q, ...extra }));

describe("buildSearchCriteria", () => {
  it("treats a bare term as full-text search", () => {
    const { criteria, hasAttachment } = parse("invoice");
    expect(criteria).toEqual({ text: "invoice" });
    expect(hasAttachment).toBe(false);
  });

  it("compiles from/to/subject/body operators", () => {
    const { criteria } = parse("from:alice@x.com to:bob@y.com subject:report body:numbers");
    expect(criteria.from).toBe("alice@x.com");
    expect(criteria.to).toBe("bob@y.com");
    expect(criteria.subject).toBe("report");
    expect(criteria.body).toBe("numbers");
  });

  it("supports quoted operator values and residual free text", () => {
    const { criteria } = parse('subject:"quarterly report" urgent');
    expect(criteria.subject).toBe("quarterly report");
    expect(criteria.text).toBe("urgent");
  });

  it("parses date operators into since/before", () => {
    const { criteria } = parse("after:2026-01-01 before:2026-02-01");
    expect(criteria.since).toBeInstanceOf(Date);
    expect(criteria.before).toBeInstanceOf(Date);
    expect((criteria.since as Date).getUTCFullYear()).toBe(2026);
  });

  it("maps has:attachment and is: flags", () => {
    const a = parse("has:attachment is:unread");
    expect(a.hasAttachment).toBe(true);
    expect(a.criteria.seen).toBe(false);
    const b = parse("is:starred report");
    expect(b.criteria.flagged).toBe(true);
    expect(b.criteria.text).toBe("report");
  });

  it("falls back to ALL when only has:attachment is given", () => {
    const { criteria, hasAttachment } = parse("has:attachment");
    expect(criteria).toEqual({ all: true });
    expect(hasAttachment).toBe(true);
  });

  it("lets explicit structured fields override operators", () => {
    const { criteria, hasAttachment } = parse("from:alice@x.com", {
      from: "carol@z.com",
      has_attachment: "true",
    });
    expect(criteria.from).toBe("carol@z.com");
    expect(hasAttachment).toBe(true);
  });
});
