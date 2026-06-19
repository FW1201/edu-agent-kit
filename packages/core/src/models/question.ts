import { z } from "zod";
import { BloomLevel, Difficulty, MediaRef } from "./common.js";

/**
 * Supported question types across all target platforms. Not every platform
 * supports every type; adapters downgrade/skip unsupported types and report it.
 */
export const QuestionType = z.enum([
  "multiple_choice", // single correct answer
  "multiple_select", // multiple correct answers
  "true_false",
  "fill_blank",
  "short_answer", // open-ended, auto/rubric graded
  "open_ended", // long-form, rubric graded
  "poll", // ungraded opinion
  "word_cloud", // ungraded free text aggregation
  "matching",
  "ordering",
  "draw", // free draw response
]);
export type QuestionType = z.infer<typeof QuestionType>;

/** A single answer option for choice-style questions. */
export const AnswerOption = z
  .object({
    text: z.string().min(1).max(1000),
    correct: z.boolean().default(false),
    /** The depth differentiator: WHY this distractor is wrong / right. */
    rationale: z
      .string()
      .max(1000)
      .optional()
      .describe("Explanation of why this option is correct or a misconception."),
    media: MediaRef.optional(),
  })
  .strict();
export type AnswerOption = z.infer<typeof AnswerOption>;

/** Scoring rubric criterion for open-ended/short-answer questions. */
export const RubricCriterion = z
  .object({
    criterion: z.string().min(1).max(500),
    points: z.number().min(0).max(100),
    descriptor: z
      .string()
      .max(1000)
      .optional()
      .describe("What a response meeting this criterion looks like."),
  })
  .strict();
export type RubricCriterion = z.infer<typeof RubricCriterion>;

/**
 * A single question. The fields beyond `prompt`/`options` — `explanation`,
 * `rubric`, `bloomLevel`, `optionRationales` — are what make generated content
 * deeper than native platform AI output.
 */
export const Question = z
  .object({
    type: QuestionType,
    prompt: z.string().min(1).max(4000).describe("The question stem."),
    options: z
      .array(AnswerOption)
      .default([])
      .describe("Answer options for choice/matching/ordering types."),
    /** For fill_blank/short_answer: accepted answer strings. */
    acceptedAnswers: z.array(z.string().min(1).max(1000)).default([]),
    /** Worked explanation of the correct answer — surfaced to learners. */
    explanation: z
      .string()
      .max(4000)
      .optional()
      .describe("Worked solution / explanation shown after answering."),
    rubric: z
      .array(RubricCriterion)
      .default([])
      .describe("Rubric for open-ended grading (also pushed to Classroom)."),
    bloomLevel: BloomLevel.optional(),
    difficulty: Difficulty.optional(),
    points: z.number().min(0).max(1000).default(1),
    timeLimitSeconds: z
      .number()
      .int()
      .min(5)
      .max(7200)
      .optional()
      .describe("Per-question time limit where the platform supports it."),
    media: MediaRef.optional(),
    tags: z.array(z.string().max(60)).default([]),
  })
  .strict();
export type Question = z.infer<typeof Question>;
