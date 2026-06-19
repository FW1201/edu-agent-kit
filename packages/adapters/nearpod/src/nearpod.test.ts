import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildNearpodPptx } from "./pptx.js";
import type { Lesson } from "@edu-agent-kit/core";

const tmpDir = path.join(os.tmpdir(), `nearpod-test-${Date.now()}`);

const lesson: Lesson = {
  title: "Photosynthesis Basics",
  language: "zh-TW",
  objectives: ["Explain how plants convert light to energy"],
  slides: [
    {
      type: "content",
      title: "What is photosynthesis?",
      body: "Plants use light to make glucose.",
      bullets: ["Light reactions", "Calvin cycle"],
      media: [],
      speakerNotes: "Emphasize energy transformation.",
    },
    {
      type: "assessment",
      title: "Check understanding",
      body: "",
      bullets: [],
      media: [],
      embeddedQuestion: {
        type: "multiple_choice",
        prompt: "Where do light reactions occur?",
        options: [
          { text: "Thylakoid", correct: true, rationale: "Correct." },
          { text: "Stroma", correct: false, rationale: "Calvin cycle site." },
        ],
        acceptedAnswers: [],
        rubric: [],
        bloomLevel: "understand",
        points: 1,
        tags: [],
      },
    },
  ],
  sources: [],
  metadata: {},
};

describe("buildNearpodPptx", () => {
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes a non-empty .pptx with the right slide count", async () => {
    const outPath = path.join(tmpDir, "lesson.pptx");
    const result = await buildNearpodPptx(lesson, outPath);
    // Title slide + 2 content slides.
    expect(result.slideCount).toBe(3);
    const stat = await fs.stat(result.path);
    expect(stat.size).toBeGreaterThan(1000);
  });
});
