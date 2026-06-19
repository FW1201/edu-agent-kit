import { describe, it, expect } from "vitest";
import { buildWordwallContent } from "./content.js";
import type { Quiz } from "@edu-agent-kit/core";

const quiz: Quiz = {
  title: "Vocabulary",
  language: "zh-TW",
  questions: [
    {
      type: "multiple_choice",
      prompt: "Apple",
      options: [
        { text: "蘋果", correct: true, rationale: "" },
        { text: "香蕉", correct: false, rationale: "" },
      ],
      acceptedAnswers: [],
      rubric: [],
      points: 1,
      tags: [],
    },
  ],
  sources: [],
  metadata: {},
};

describe("buildWordwallContent", () => {
  it("builds quiz-template CSV with a header and question row", () => {
    const out = buildWordwallContent({ quiz }, "quiz");
    expect(out.csv.split("\n")[0]).toContain("question");
    expect(out.csv).toContain("Apple");
    expect(out.txt).toContain("Vocabulary");
  });

  it("builds match_up CSV from explicit pairs", () => {
    const out = buildWordwallContent(
      {
        title: "Match",
        pairs: [
          { term: "Dog", definition: "狗" },
          { term: "Cat", definition: "貓" },
        ],
      },
      "match_up",
    );
    expect(out.csv).toContain("Dog");
    expect(out.csv).toContain("狗");
    expect(out.csv).toContain("Cat");
  });

  it("derives match_up pairs from a quiz", () => {
    const out = buildWordwallContent({ quiz }, "match_up");
    expect(out.csv).toContain("Apple");
    expect(out.csv).toContain("蘋果");
  });
});
