import { describe, it, expect } from "vitest";
import {
  recommendBloomDistribution,
  scoreDepth,
  validateQuiz,
  type Quiz,
} from "./index.js";

describe("recommendBloomDistribution", () => {
  it("sums to the requested count", () => {
    for (const count of [1, 5, 10, 13, 20]) {
      const dist = recommendBloomDistribution(count);
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      expect(total).toBe(count);
    }
  });

  it("weights higher-order levels for a 10-question quiz", () => {
    const dist = recommendBloomDistribution(10);
    const higher = dist.apply + dist.analyze + dist.evaluate + dist.create;
    expect(higher).toBeGreaterThanOrEqual(5);
  });
});

describe("validateQuiz + scoreDepth", () => {
  const deepQuiz: Quiz = {
    title: "Photosynthesis",
    language: "zh-TW",
    questions: [
      {
        type: "multiple_choice",
        prompt: "Which process converts light to chemical energy?",
        options: [
          { text: "Photosynthesis", correct: true, rationale: "Correct." },
          {
            text: "Respiration",
            correct: false,
            rationale: "Releases energy, not stores it.",
          },
        ],
        acceptedAnswers: [],
        explanation: "Photosynthesis stores light energy as glucose.",
        rubric: [],
        bloomLevel: "analyze",
        points: 1,
        tags: [],
      },
    ],
    sources: [],
    metadata: {},
  };

  it("accepts a well-formed quiz", () => {
    const res = validateQuiz(deepQuiz);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it("rejects a quiz with no questions", () => {
    const res = validateQuiz({ title: "x", questions: [] });
    expect(res.valid).toBe(false);
  });

  it("scores higher-order + explained content well", () => {
    const report = scoreDepth(deepQuiz);
    expect(report.score).toBeGreaterThan(50);
  });

  it("flags shallow content with warnings", () => {
    const shallow: Quiz = {
      ...deepQuiz,
      questions: [
        {
          type: "multiple_choice",
          prompt: "What color is the sky?",
          options: [
            { text: "Blue", correct: true, rationale: "" },
            { text: "Green", correct: false, rationale: "" },
          ],
          acceptedAnswers: [],
          rubric: [],
          bloomLevel: "remember",
          points: 1,
          tags: [],
        },
      ],
    };
    const report = scoreDepth(shallow);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.higherOrderRatio).toBe(0);
  });
});
