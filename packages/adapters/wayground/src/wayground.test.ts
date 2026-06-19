import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import ExcelJS from "exceljs";
import { buildWaygroundWorkbook } from "./workbook.js";
import type { Quiz } from "@edu-agent-kit/core";

const tmpDir = path.join(os.tmpdir(), `wayground-test-${Date.now()}`);

const quiz: Quiz = {
  title: "History Quiz",
  language: "zh-TW",
  questions: [
    {
      type: "multiple_choice",
      prompt: "Who painted the Mona Lisa?",
      options: [
        { text: "Da Vinci", correct: true, rationale: "" },
        { text: "Picasso", correct: false, rationale: "" },
      ],
      acceptedAnswers: [],
      rubric: [],
      points: 1,
      tags: [],
    },
    {
      type: "multiple_select",
      prompt: "Select the primary colors.",
      options: [
        { text: "Red", correct: true, rationale: "" },
        { text: "Green", correct: false, rationale: "" },
        { text: "Blue", correct: true, rationale: "" },
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

describe("buildWaygroundWorkbook", () => {
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes header and rows with correct type labels and answer indices", async () => {
    const outPath = path.join(tmpDir, "quiz.xlsx");
    const result = await buildWaygroundWorkbook(quiz, outPath);
    expect(result.questionCount).toBe(2);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(result.path);
    const ws = wb.getWorksheet("Quiz")!;
    expect(ws.getRow(1).getCell(1).value).toBe("Question Text");

    const r2 = ws.getRow(2);
    expect(r2.getCell(1).value).toBe("Who painted the Mona Lisa?");
    expect(r2.getCell(2).value).toBe("Multiple Choice");
    expect(String(r2.getCell(8).value)).toBe("1");

    const r3 = ws.getRow(3);
    expect(r3.getCell(2).value).toBe("Checkbox");
    expect(String(r3.getCell(8).value)).toBe("1,3");
  });
});
