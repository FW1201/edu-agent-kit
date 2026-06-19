import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Quiz, Question } from "@interactive-edtech/core";

// Wayground (formerly Quizizz) spreadsheet-import template. Plain text only;
// max 1 image per question. Valid time values per the importer.
export const VALID_TIMES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300];
export const DEFAULT_TIME = 30;
export const MAX_OPTIONS = 5;

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  true_false: "Multiple Choice",
  multiple_select: "Checkbox",
  fill_blank: "Fill in the Blank",
  short_answer: "Open-Ended",
  open_ended: "Open-Ended",
  poll: "Poll",
};

/** Strip rich text / newlines to plain single-line text. */
function plain(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function snapTime(seconds: number | undefined): number {
  const t = seconds ?? DEFAULT_TIME;
  let best = VALID_TIMES[0];
  for (const v of VALID_TIMES) {
    if (Math.abs(v - t) < Math.abs(best - t)) best = v;
  }
  return best;
}

interface WaygroundRow {
  questionText: string;
  type: string;
  options: string[];
  correct: string;
  time: number;
  image: string;
}

function mapQuestion(
  q: Question,
  idx: number,
  warnings: string[],
): WaygroundRow | null {
  const type = TYPE_LABEL[q.type];
  if (!type) {
    warnings.push(`Q${idx + 1}: type '${q.type}' unsupported by Wayground import — skipped.`);
    return null;
  }

  let options = q.options;
  if (q.type === "true_false") {
    const correctIsTrue = q.options.some(
      (o) => o.correct && /^(true|t|是|對|正確)$/i.test(o.text.trim()),
    );
    options = [
      { text: "True", correct: correctIsTrue, rationale: "", media: undefined },
      { text: "False", correct: !correctIsTrue, rationale: "", media: undefined },
    ];
  }

  const isChoice =
    q.type === "multiple_choice" ||
    q.type === "multiple_select" ||
    q.type === "true_false" ||
    q.type === "poll";

  const usable = options.slice(0, MAX_OPTIONS);
  if (isChoice && usable.length < 2 && q.type !== "poll") {
    warnings.push(`Q${idx + 1}: fewer than 2 options — skipped.`);
    return null;
  }
  if (options.length > MAX_OPTIONS) {
    warnings.push(`Q${idx + 1}: Wayground allows max ${MAX_OPTIONS} options — extras dropped.`);
  }

  let correct = "";
  if (q.type === "multiple_choice" || q.type === "true_false") {
    const i = usable.findIndex((o) => o.correct);
    if (i < 0) {
      warnings.push(`Q${idx + 1}: no correct option marked — skipped.`);
      return null;
    }
    correct = String(i + 1);
  } else if (q.type === "multiple_select") {
    const idxs = usable.map((o, i) => (o.correct ? i + 1 : 0)).filter((n) => n > 0);
    if (idxs.length === 0) {
      warnings.push(`Q${idx + 1}: no correct options marked — skipped.`);
      return null;
    }
    correct = idxs.join(",");
  } else if (q.type === "fill_blank") {
    correct = q.acceptedAnswers.map(plain).join(" | ");
  }
  // open_ended / poll: no correct answer.

  const image = q.media?.kind === "image" ? q.media.url : "";

  return {
    questionText: plain(q.prompt),
    type,
    options: usable.map((o) => plain(o.text)),
    correct,
    time: snapTime(q.timeLimitSeconds),
    image,
  };
}

/**
 * Build a Wayground/Quizizz-importable .xlsx from a Quiz, matching their
 * spreadsheet template columns. Strips formatting to plain text. Returns the
 * written path and warnings for skipped/downgraded/stripped content.
 */
export async function buildWaygroundWorkbook(
  quiz: Quiz,
  outPath: string,
): Promise<{ path: string; warnings: string[]; questionCount: number }> {
  const warnings: string[] = [];
  const wb = new ExcelJS.Workbook();
  wb.creator = "interactive-edtech-mcp";
  const ws = wb.addWorksheet("Quiz");

  const header = [
    "Question Text",
    "Question Type",
    "Option 1",
    "Option 2",
    "Option 3",
    "Option 4",
    "Option 5",
    "Correct Answer",
    "Time in seconds",
    "Image Link (optional)",
  ];
  ws.getRow(1).values = header;
  ws.getRow(1).font = { bold: true };

  let rowNum = 2;
  let questionCount = 0;
  quiz.questions.forEach((q, idx) => {
    const r = mapQuestion(q, idx, warnings);
    if (!r) return;
    const o = r.options;
    ws.getRow(rowNum).values = [
      r.questionText,
      r.type,
      o[0] ?? "",
      o[1] ?? "",
      o[2] ?? "",
      o[3] ?? "",
      o[4] ?? "",
      r.correct,
      r.time,
      r.image,
    ];
    rowNum += 1;
    questionCount += 1;
  });

  if (questionCount === 0) {
    warnings.push("No questions could be mapped to Wayground's supported types.");
  }

  ws.columns.forEach((col) => {
    col.width = 22;
  });

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);
  return { path: path.resolve(outPath), warnings, questionCount };
}
