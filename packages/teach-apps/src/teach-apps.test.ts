import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildTeachApp, quizHtml, flashcardsHtml } from "./index.js";
import type { Quiz } from "@edu-agent-kit/core";

const tmp = path.join(os.tmpdir(), `teachapp-test-${Date.now()}`);

const quiz: Quiz = {
  title: "小考",
  language: "zh-TW",
  questions: [
    {
      type: "multiple_choice",
      prompt: "1+1=?",
      options: [
        { text: "2", correct: true, rationale: "" },
        { text: "3", correct: false, rationale: "" },
      ],
      acceptedAnswers: [],
      explanation: "基本加法。",
      rubric: [],
      points: 1,
      tags: [],
    },
  ],
  sources: [],
  metadata: {},
};

describe("teach-apps templates", () => {
  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("quizHtml embeds data and is self-contained", () => {
    const html = quizHtml(quiz);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("基本加法");
    expect(html).not.toContain("</script></script>");
  });

  it("flashcardsHtml renders cards", () => {
    const html = flashcardsHtml("英單", [{ front: "apple", back: "蘋果" }]);
    expect(html).toContain("apple");
    expect(html).toContain("蘋果");
  });

  it("buildTeachApp writes index.html for quiz", async () => {
    const res = await buildTeachApp({ template: "quiz", quiz, outDir: path.join(tmp, "q") });
    const html = await fs.readFile(res.indexPath, "utf8");
    expect(html).toContain("小考");
  });

  it("buildTeachApp rejects flashcards without cards", async () => {
    await expect(
      buildTeachApp({ template: "flashcards", outDir: path.join(tmp, "f") }),
    ).rejects.toThrow();
  });
});
