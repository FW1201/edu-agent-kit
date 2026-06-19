/**
 * Pure, network-free request builders for Google Workspace APIs. These map
 * core content (Lesson/Quiz) into the batchUpdate request shapes each API
 * expects, and are the unit-tested heart of this adapter.
 */
import type { docs_v1, slides_v1, forms_v1 } from "googleapis";
import type { Lesson, Quiz } from "@edu-agent-kit/core";

// --------------------------- Docs ---------------------------

export interface DocSection {
  heading?: string;
  body?: string;
  bullets?: string[];
}
export interface DocInput {
  title: string;
  sections: DocSection[];
}

/** Derive a DocInput (講義) from a Lesson. */
export function docInputFromLesson(lesson: Lesson): DocInput {
  const sections: DocSection[] = [];
  if (lesson.objectives.length) {
    sections.push({ heading: "學習目標", bullets: lesson.objectives });
  }
  for (const s of lesson.slides) {
    sections.push({
      heading: s.title,
      body: s.body || undefined,
      bullets: s.bullets.length ? s.bullets : undefined,
    });
  }
  return { title: lesson.title, sections };
}

/**
 * Build Docs batchUpdate requests: one insertText with the assembled body,
 * then paragraph-style requests (TITLE for the doc title, HEADING_1 per
 * section heading) over the indices computed from the inserted text.
 */
export function buildDocRequests(input: DocInput): docs_v1.Schema$Request[] {
  const BASE = 1;
  let text = "";
  const styles: { start: number; end: number; named: string }[] = [];

  const titleStart = BASE + text.length;
  text += input.title + "\n";
  styles.push({ start: titleStart, end: BASE + text.length, named: "TITLE" });

  for (const sec of input.sections) {
    if (sec.heading) {
      const hs = BASE + text.length;
      text += sec.heading + "\n";
      styles.push({ start: hs, end: BASE + text.length, named: "HEADING_1" });
    }
    if (sec.body) text += sec.body + "\n";
    for (const b of sec.bullets ?? []) text += "• " + b + "\n";
    text += "\n";
  }

  const requests: docs_v1.Schema$Request[] = [
    { insertText: { location: { index: BASE }, text } },
  ];
  for (const s of styles) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: s.start, endIndex: s.end },
        paragraphStyle: { namedStyleType: s.named },
        fields: "namedStyleType",
      },
    });
  }
  return requests;
}

// --------------------------- Slides ---------------------------

/**
 * Build Slides batchUpdate requests from a Lesson: one TITLE_AND_BODY slide per
 * lesson slide, with deterministic object ids and text inserted into the title
 * and body placeholders.
 */
export function buildSlideRequests(lesson: Lesson): slides_v1.Schema$Request[] {
  const requests: slides_v1.Schema$Request[] = [];
  lesson.slides.forEach((s, i) => {
    const titleId = `t_${i}`;
    const bodyId = `b_${i}`;
    requests.push({
      createSlide: {
        objectId: `slide_${i}`,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE", index: 0 }, objectId: titleId },
          { layoutPlaceholder: { type: "BODY", index: 0 }, objectId: bodyId },
        ],
      },
    });
    requests.push({ insertText: { objectId: titleId, text: s.title } });
    const bodyText = [s.body, ...s.bullets.map((b) => "• " + b)]
      .filter((x) => x && x.length > 0)
      .join("\n");
    if (bodyText) requests.push({ insertText: { objectId: bodyId, text: bodyText } });
  });
  return requests;
}

// --------------------------- Forms ---------------------------

/** Whether a Form will be a graded quiz (any question carries points/answers). */
export function buildFormRequests(quiz: Quiz): {
  isQuiz: boolean;
  requests: forms_v1.Schema$Request[];
} {
  const requests: forms_v1.Schema$Request[] = [];
  let index = 0;
  for (const q of quiz.questions) {
    const choice = q.type === "multiple_choice" || q.type === "true_false" || q.type === "multiple_select" || q.type === "poll";
    const item: forms_v1.Schema$Item = { title: q.prompt };
    const question: forms_v1.Schema$Question = {};
    if (choice) {
      const options = (q.type === "true_false" ? [{ text: "True" }, { text: "False" }] : q.options).map(
        (o) => ({ value: "text" in o ? o.text : String(o) }),
      );
      question.choiceQuestion = {
        type: q.type === "multiple_select" ? "CHECKBOX" : "RADIO",
        options,
      };
      const correct = q.options.filter((o) => o.correct).map((o) => ({ value: o.text }));
      if (q.type !== "poll" && correct.length > 0) {
        question.grading = {
          pointValue: q.points || 1,
          correctAnswers: { answers: correct },
        };
      }
    } else {
      question.textQuestion = { paragraph: q.type === "open_ended" };
      if (q.acceptedAnswers.length > 0 || q.rubric.length > 0) {
        question.grading = {
          pointValue: q.points || 1,
          ...(q.acceptedAnswers.length
            ? { correctAnswers: { answers: q.acceptedAnswers.map((a) => ({ value: a })) } }
            : {}),
        };
      }
    }
    item.questionItem = { question };
    requests.push({ createItem: { item, location: { index } } });
    index += 1;
  }
  const isQuiz = quiz.questions.some(
    (q) => q.options.some((o) => o.correct) || q.acceptedAnswers.length > 0,
  );
  return { isQuiz, requests };
}

// --------------------------- Sheets ---------------------------

export interface SheetInput {
  /** Header row labels. */
  headers: string[];
  /** Data rows (each a list of cell values). */
  rows: (string | number)[][];
}

/** Build a 2D value grid (header + rows) for Sheets values.update. */
export function buildSheetGrid(input: SheetInput): (string | number)[][] {
  return [input.headers, ...input.rows];
}

/** Convenience: a Quiz → a question bank grid. */
export function sheetGridFromQuiz(quiz: Quiz): (string | number)[][] {
  const headers = ["#", "Type", "Prompt", "Options", "Correct", "Bloom", "Explanation"];
  const rows = quiz.questions.map((q, i) => [
    i + 1,
    q.type,
    q.prompt,
    q.options.map((o) => o.text).join(" | "),
    q.options.filter((o) => o.correct).map((o) => o.text).join(" | ") || q.acceptedAnswers.join(" | "),
    q.bloomLevel ?? "",
    q.explanation ?? "",
  ]);
  return [headers, ...rows];
}
