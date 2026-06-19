import { describe, it, expect } from "vitest";
import { alignCurriculum, listCurriculumDomains } from "./curriculum.js";

describe("alignCurriculum", () => {
  it("matches a known domain and seeds core competencies", () => {
    const a = alignCurriculum({ gradeLevel: "國中一年級", domain: "數學" });
    expect(a.framework).toBe("108課綱");
    expect(a.domain).toBe("數學");
    expect(a.coreCompetencies.length).toBeGreaterThan(0);
    expect(a.bloomFocus).toContain("analyze");
  });

  it("matches via alias (english -> 英語文)", () => {
    const a = alignCurriculum({ gradeLevel: "Grade 5", domain: "english" });
    expect(a.domain).toBe("英語文");
  });

  it("returns a usable generic alignment for unknown domains", () => {
    const a = alignCurriculum({ gradeLevel: "Grade 1", domain: "Underwater Basketweaving" });
    expect(a.domain).toBe("Underwater Basketweaving");
    expect(a.coreCompetencies.length).toBeGreaterThan(0);
  });
});

describe("listCurriculumDomains", () => {
  it("lists the seeded domains", () => {
    const domains = listCurriculumDomains();
    expect(domains).toContain("國語文");
    expect(domains.length).toBeGreaterThanOrEqual(5);
  });
});
