import { promises as fs } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { Quiz, Question } from "@edu-agent-kit/core";

// Kahoot spreadsheet-import constraints (per Kahoot's official template).
export const QUESTION_MAX = 120;
export const ANSWER_MAX = 75;
export const MIN_ANSWERS = 2;
export const MAX_ANSWERS = 4;
export const VALID_TIME_LIMITS = [5, 10, 20, 30, 60, 90, 120, 240];
export const DEFAULT_TIME_LIMIT = 30;

const SUPPORTED: ReadonlySet<string> = new Set([
  "multiple_choice",
  "multiple_select",
  "true_false",
]);

export interface BuildKahootOptions {
  defaultTimeLimitSeconds?: number;
}

function snapTimeLimit(seconds: number | undefined, fallback: number): number {
  const target = seconds ?? fallback;
  let best = VALID_TIME_LIMITS[0];
  for (const v of VALID_TIME_LIMITS) {
    if (Math.abs(v - target) < Math.abs(best - target)) best = v;
  }
  return best;
}

function truncate(text: string, max: number, warn: () => void): string {
  if (text.length <= max) return text;
  warn();
  return text.slice(0, max);
}

interface KahootRow {
  question: string;
  answers: string[];
  timeLimit: number;
  correct: string;
}

/** Map one core Question to a Kahoot row, or null if unsupported. */
function mapQuestion(
  q: Question,
  idx: number,
  defaultTime: number,
  warnings: string[],
): KahootRow | null {
  if (!SUPPORTED.has(q.type)) {
    warnings.push(
      `Q${idx + 1}: type '${q.type}' is not supported by Kahoot import — skipped.`,
    );
    return null;
  }

  let options = q.options;
  if (q.type === "true_false") {
    // Normalize to True/False ordering, preserving which is correct.
    const correctIsTrue = q.options.some(
      (o) => o.correct && /^(true|t|是|對|正確)$/i.test(o.text.trim()),
    );
    options = [
      { text: "True", correct: correctIsTrue, rationale: "", media: undefined },
      { text: "False", correct: !correctIsTrue, rationale: "", media: undefined },
    ];
  }

  const usable = options.slice(0, MAX_ANSWERS);
  if (usable.length < MIN_ANSWERS) {
    warnings.push(
      `Q${idx + 1}: fewer than ${MIN_ANSWERS} answers — skipped.`,
    );
    return null;
  }
  if (options.length > MAX_ANSWERS) {
    warnings.push(
      `Q${idx + 1}: had ${options.length} options; Kahoot allows max ${MAX_ANSWERS} — extras dropped.`,
    );
  }

  const answers = usable.map((o) =>
    truncate(o.text, ANSWER_MAX, () =>
      warnings.push(`Q${idx + 1}: an answer exceeded ${ANSWER_MAX} chars — truncated.`),
    ),
  );

  const correctIdx = usable
    .map((o, i) => (o.correct ? i + 1 : 0))
    .filter((n) => n > 0);
  if (correctIdx.length === 0) {
    warnings.push(`Q${idx + 1}: no correct answer marked — skipped.`);
    return null;
  }

  return {
    question: truncate(q.prompt, QUESTION_MAX, () =>
      warnings.push(`Q${idx + 1}: question exceeded ${QUESTION_MAX} chars — truncated.`),
    ),
    answers,
    timeLimit: snapTimeLimit(q.timeLimitSeconds, defaultTime),
    correct: correctIdx.join(","),
  };
}

/**
 * Build a Kahoot-importable .xlsx workbook from a Quiz, replicating the layout
 * of Kahoot's official template (instruction rows, then a header row, then one
 * row per question starting at row 9). Returns the written path and warnings
 * for any skipped/downgraded/truncated content.
 */
export async function buildKahootWorkbook(
  quiz: Quiz,
  outPath: string,
  opts: BuildKahootOptions = {},
): Promise<{ path: string; warnings: string[]; questionCount: number }> {
  const warnings: string[] = [];
  const defaultTime = snapTimeLimit(
    opts.defaultTimeLimitSeconds,
    DEFAULT_TIME_LIMIT,
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "edu-agent-kit";
  const ws = wb.addWorksheet("Kahoot");

  // Instruction rows (rows 1-7) mirror the official template's guidance area.
  ws.getCell("A1").value = `Kahoot quiz import — ${quiz.title}`;
  ws.getCell("A3").value =
    "Add questions below the header row. Question max 120 chars; answers max 75 chars.";
  ws.getCell("A4").value =
    "2-4 answers per question. Mark correct answer(s) by index, comma-separated (e.g. 1 or 2,3).";
  ws.getCell("A5").value = `Allowed time limits (sec): ${VALID_TIME_LIMITS.join(", ")}.`;

  // Header row (row 8).
  const headerRowNum = 8;
  ws.getRow(headerRowNum).values = [
    "Question - max 120 characters",
    "Answer 1 - max 75 characters",
    "Answer 2 - max 75 characters",
    "Answer 3 - max 75 characters",
    "Answer 4 - max 75 characters",
    "Time limit (sec)",
    "Correct answer(s)",
  ];
  ws.getRow(headerRowNum).font = { bold: true };

  let rowNum = headerRowNum + 1;
  let questionCount = 0;
  quiz.questions.forEach((q, idx) => {
    const row = mapQuestion(q, idx, defaultTime, warnings);
    if (!row) return;
    const a = row.answers;
    ws.getRow(rowNum).values = [
      row.question,
      a[0] ?? "",
      a[1] ?? "",
      a[2] ?? "",
      a[3] ?? "",
      row.timeLimit,
      row.correct,
    ];
    rowNum += 1;
    questionCount += 1;
  });

  if (questionCount === 0) {
    warnings.push("No questions could be mapped to Kahoot's supported types.");
  }

  // Column widths for readability.
  ws.columns.forEach((col) => {
    col.width = 28;
  });

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);
  return { path: path.resolve(outPath), warnings, questionCount };
}
