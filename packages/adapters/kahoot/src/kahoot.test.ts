import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import ExcelJS from "exceljs";
import { buildKahootWorkbook, QUESTION_MAX } from "./workbook.js";
import { analyzeReport } from "./reports.js";
import type { Quiz } from "@edu-agent-kit/core";

const tmpDir = path.join(os.tmpdir(), `kahoot-test-${Date.now()}`);

const quiz: Quiz = {
  title: "Science Quiz",
  language: "zh-TW",
  questions: [
    {
      type: "multiple_choice",
      prompt: "What gas do plants absorb?",
      options: [
        { text: "Carbon dioxide", correct: true, rationale: "" },
        { text: "Oxygen", correct: false, rationale: "" },
        { text: "Nitrogen", correct: false, rationale: "" },
      ],
      acceptedAnswers: [],
      rubric: [],
      bloomLevel: "remember",
      points: 1,
      timeLimitSeconds: 20,
      tags: [],
    },
    {
      type: "open_ended",
      prompt: "Explain photosynthesis.",
      options: [],
      acceptedAnswers: [],
      rubric: [{ criterion: "Mentions light", points: 1 }],
      bloomLevel: "analyze",
      points: 1,
      tags: [],
    },
  ],
  sources: [],
  metadata: {},
};

describe("buildKahootWorkbook", () => {
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes the mapped multiple_choice row and warns on unsupported types", async () => {
    const outPath = path.join(tmpDir, "quiz.xlsx");
    const result = await buildKahootWorkbook(quiz, outPath);
    expect(result.questionCount).toBe(1);
    expect(result.warnings.join(" ")).toMatch(/open_ended/);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(result.path);
    const ws = wb.getWorksheet("Kahoot");
    expect(ws).toBeTruthy();
    // Data starts at row 9 (header is row 8).
    const row9 = ws!.getRow(9);
    expect(row9.getCell(1).value).toBe("What gas do plants absorb?");
    expect(row9.getCell(2).value).toBe("Carbon dioxide");
    expect(row9.getCell(6).value).toBe(20);
    expect(String(row9.getCell(7).value)).toBe("1");
  });

  it("truncates over-long questions", async () => {
    const longQuiz: Quiz = {
      ...quiz,
      questions: [
        {
          ...quiz.questions[0],
          prompt: "Q".repeat(QUESTION_MAX + 50),
        },
      ],
    };
    const outPath = path.join(tmpDir, "long.xlsx");
    const result = await buildKahootWorkbook(longQuiz, outPath);
    expect(result.warnings.join(" ")).toMatch(/truncated/);
  });
});

describe("analyzeReport", () => {
  it("computes participants, average score, and per-question correctness", () => {
    const report = {
      players: [{ totalScore: 100 }, { totalScore: 200 }],
      questions: [
        { title: "Q1", correctCount: 1, totalAnswers: 2 },
        { title: "Q2", correctPercentage: 75 },
      ],
    };
    const summary = analyzeReport(report);
    expect(summary.participants).toBe(2);
    expect(summary.averageScore).toBe(150);
    expect(summary.perQuestion[0].correctPct).toBe(50);
    expect(summary.perQuestion[1].correctPct).toBe(75);
  });
});
