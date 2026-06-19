import { describe, it, expect } from "vitest";
import {
  buildDocRequests,
  docInputFromLesson,
  buildSlideRequests,
  buildFormRequests,
  sheetGridFromQuiz,
} from "./builders.js";
import type { Lesson, Quiz } from "@edu-agent-kit/core";

const lesson: Lesson = {
  title: "光合作用",
  language: "zh-TW",
  objectives: ["說明光合作用如何把光能轉為化學能"],
  slides: [
    { type: "content", title: "什麼是光合作用", body: "植物利用光能製造葡萄糖。", bullets: ["光反應", "卡爾文循環"], media: [] },
  ],
  sources: [],
  metadata: {},
};

const quiz: Quiz = {
  title: "小考",
  language: "zh-TW",
  questions: [
    {
      type: "multiple_choice",
      prompt: "光反應發生在哪裡？",
      options: [
        { text: "類囊體", correct: true, rationale: "" },
        { text: "基質", correct: false, rationale: "" },
      ],
      acceptedAnswers: [],
      rubric: [],
      points: 2,
      tags: [],
    },
  ],
  sources: [],
  metadata: {},
};

describe("buildDocRequests", () => {
  it("inserts text and styles the title", () => {
    const input = docInputFromLesson(lesson);
    const reqs = buildDocRequests(input);
    expect(reqs[0].insertText?.text).toContain("光合作用");
    expect(reqs[0].insertText?.text).toContain("學習目標");
    const titleStyle = reqs.find((r) => r.updateParagraphStyle?.paragraphStyle?.namedStyleType === "TITLE");
    expect(titleStyle).toBeTruthy();
    expect(titleStyle?.updateParagraphStyle?.range?.startIndex).toBe(1);
  });
});

describe("buildSlideRequests", () => {
  it("creates one slide with title+body inserts", () => {
    const reqs = buildSlideRequests(lesson);
    expect(reqs.some((r) => r.createSlide?.objectId === "slide_0")).toBe(true);
    const titleInsert = reqs.find((r) => r.insertText?.objectId === "t_0");
    expect(titleInsert?.insertText?.text).toBe("什麼是光合作用");
  });
});

describe("buildFormRequests", () => {
  it("marks a graded quiz and builds a choice item with correct answer", () => {
    const { isQuiz, requests } = buildFormRequests(quiz);
    expect(isQuiz).toBe(true);
    const item = requests[0].createItem?.item;
    expect(item?.title).toBe("光反應發生在哪裡？");
    expect(item?.questionItem?.question?.choiceQuestion?.type).toBe("RADIO");
    expect(item?.questionItem?.question?.grading?.correctAnswers?.answers?.[0].value).toBe("類囊體");
  });
});

describe("sheetGridFromQuiz", () => {
  it("produces a header + one row per question", () => {
    const grid = sheetGridFromQuiz(quiz);
    expect(grid[0]).toContain("Prompt");
    expect(grid).toHaveLength(2);
    expect(grid[1][2]).toBe("光反應發生在哪裡？");
  });
});
