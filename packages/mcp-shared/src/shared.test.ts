import { describe, it, expect } from "vitest";
import { paginate, truncateText, CHARACTER_LIMIT } from "./format.js";
import { handleApiError, ToolError, MissingCredentialError } from "./errors.js";
import { dualResult, errorResult, textResult } from "./tooldef.js";

describe("paginate", () => {
  it("returns a page with has_more and next_offset", () => {
    const all = Array.from({ length: 50 }, (_, i) => i);
    const page = paginate(all, { limit: 20, offset: 0 });
    expect(page.total).toBe(50);
    expect(page.count).toBe(20);
    expect(page.has_more).toBe(true);
    expect(page.next_offset).toBe(20);
  });

  it("omits next_offset on the last page", () => {
    const all = [1, 2, 3];
    const page = paginate(all, { limit: 20, offset: 0 });
    expect(page.has_more).toBe(false);
    expect(page.next_offset).toBeUndefined();
  });
});

describe("truncateText", () => {
  it("does not truncate short text", () => {
    expect(truncateText("hello").truncated).toBe(false);
  });
  it("truncates text over the limit", () => {
    const long = "x".repeat(CHARACTER_LIMIT + 100);
    const res = truncateText(long);
    expect(res.truncated).toBe(true);
    expect(res.text.length).toBeLessThan(long.length);
  });
});

describe("handleApiError", () => {
  it("maps status codes to actionable messages", () => {
    expect(handleApiError(new ToolError("x", 429), "Svc")).toMatch(/Rate limit/);
    expect(handleApiError(new MissingCredentialError("FOO_KEY"))).toMatch(/FOO_KEY/);
  });
});

describe("result helpers", () => {
  it("textResult / errorResult / dualResult shape", () => {
    expect(textResult("a").content[0].text).toBe("a");
    expect(errorResult("e").isError).toBe(true);
    const d = dualResult("t", { a: 1 });
    expect(d.structuredContent).toEqual({ a: 1 });
  });
});
