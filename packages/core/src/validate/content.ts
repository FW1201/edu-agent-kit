import { z } from "zod";
import { Quiz } from "../models/quiz.js";
import { Lesson } from "../models/lesson.js";
import { Board } from "../models/board.js";

export interface ValidationResult<T> {
  valid: boolean;
  /** Parsed + normalized value (defaults applied) when valid. */
  value?: T;
  errors: string[];
  warnings: string[];
}

function formatZodError(err: z.ZodError): string[] {
  return err.issues.map((i) => {
    const path = i.path.join(".");
    return path ? `${path}: ${i.message}` : i.message;
  });
}

/** Validate + normalize a quiz draft against the canonical schema. */
export function validateQuiz(input: unknown): ValidationResult<Quiz> {
  const parsed = Quiz.safeParse(input);
  if (!parsed.success) {
    return { valid: false, errors: formatZodError(parsed.error), warnings: [] };
  }
  const quiz = parsed.data;
  const warnings: string[] = [];

  quiz.questions.forEach((q, idx) => {
    const n = idx + 1;
    const choiceType =
      q.type === "multiple_choice" ||
      q.type === "multiple_select" ||
      q.type === "true_false";
    if (choiceType) {
      if (q.options.length < 2) {
        warnings.push(`Q${n}: choice question has fewer than 2 options.`);
      }
      if (!q.options.some((o) => o.correct)) {
        warnings.push(`Q${n}: no option marked correct.`);
      }
    }
    if (
      (q.type === "fill_blank" || q.type === "short_answer") &&
      q.acceptedAnswers.length === 0 &&
      q.rubric.length === 0
    ) {
      warnings.push(
        `Q${n}: ${q.type} has neither acceptedAnswers nor a rubric.`,
      );
    }
  });

  return { valid: true, value: quiz, warnings, errors: [] };
}

export function validateLesson(input: unknown): ValidationResult<Lesson> {
  const parsed = Lesson.safeParse(input);
  if (!parsed.success) {
    return { valid: false, errors: formatZodError(parsed.error), warnings: [] };
  }
  const lesson = parsed.data;
  const warnings: string[] = [];
  const hasActive = lesson.slides.some(
    (s) => s.type === "activity" || s.type === "assessment" || s.embeddedQuestion,
  );
  if (!hasActive) {
    warnings.push(
      "Lesson has no activity/assessment slides or embedded questions — add active-learning checkpoints.",
    );
  }
  if (lesson.objectives.length === 0) {
    warnings.push("Lesson has no stated learning objectives.");
  }
  return { valid: true, value: lesson, warnings, errors: [] };
}

export function validateBoard(input: unknown): ValidationResult<Board> {
  const parsed = Board.safeParse(input);
  if (!parsed.success) {
    return { valid: false, errors: formatZodError(parsed.error), warnings: [] };
  }
  const board = parsed.data;
  const warnings: string[] = [];
  if (board.seedPosts.length === 0) {
    warnings.push("Board has no seed posts — students get a blank board.");
  }
  return { valid: true, value: board, warnings, errors: [] };
}
