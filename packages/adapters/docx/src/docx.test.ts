import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildLessonDoc, buildQuizDoc, writeDocx } from "./index.js";
import type { Lesson, Quiz } from "@edu-agent-kit/core";

const tmp = path.join(os.tmpdir(), `docx-test-${Date.now()}`);

const lesson: Lesson = {
  title: "光合作用",
  language: "zh-TW",
  objectives: ["說明光合作用"],
  slides: [{ type: "content", title: "光反應", body: "在類囊體發生。", bullets: ["葉綠素"], media: [] }],
  sources: [],
  metadata: {},
};

const quiz: Quiz = {
  title: "小考",
  language: "zh-TW",
  questions: [
    {
      type: "multiple_choice",
      prompt: "光反應在哪裡？",
      options: [
        { text: "類囊體", correct: true, rationale: "" },
        { text: "基質", correct: false, rationale: "" },
      ],
      acceptedAnswers: [],
      explanation: "類囊體膜含葉綠素。",
      rubric: [],
      points: 1,
      tags: [],
    },
  ],
  sources: [],
  metadata: {},
};

describe("docx builders", () => {
  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes a non-empty lesson .docx", async () => {
    const p = await writeDocx(buildLessonDoc(lesson), path.join(tmp, "lesson.docx"));
    const stat = await fs.stat(p);
    expect(stat.size).toBeGreaterThan(1000);
  });

  it("writes student and teacher quiz .docx", async () => {
    const student = await writeDocx(buildQuizDoc(quiz, false), path.join(tmp, "q.docx"));
    const teacher = await writeDocx(buildQuizDoc(quiz, true), path.join(tmp, "q-teacher.docx"));
    expect((await fs.stat(student)).size).toBeGreaterThan(800);
    expect((await fs.stat(teacher)).size).toBeGreaterThan(800);
  });
});
