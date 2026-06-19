import { z } from "zod";
import { LanguageCode, GradeLevel, MediaRef } from "./common.js";
import { Question } from "./question.js";
import { CurriculumAlignment } from "./curriculum.js";
import { SourceMaterial } from "./source.js";

/** A single slide within an interactive lesson. */
export const Slide = z
  .object({
    type: z
      .enum(["content", "media", "activity", "assessment", "discussion"])
      .default("content"),
    title: z.string().max(300),
    body: z
      .string()
      .max(8000)
      .default("")
      .describe("Markdown body / speaker-facing content for the slide."),
    bullets: z.array(z.string().min(1).max(1000)).default([]),
    media: z.array(MediaRef).default([]),
    /** Embedded formative-assessment question (Nearpod/Classroom style). */
    embeddedQuestion: Question.optional(),
    speakerNotes: z.string().max(8000).optional(),
  })
  .strict();
export type Slide = z.infer<typeof Slide>;

/**
 * An interactive lesson — produced for Nearpod (Slides export) and reusable as
 * Classroom courseWorkMaterial. Holds slides plus optional standalone activities.
 */
export const Lesson = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional(),
    gradeLevel: GradeLevel.optional(),
    language: LanguageCode.default("zh-TW"),
    objectives: z
      .array(z.string().min(1).max(500))
      .default([])
      .describe("Lesson learning objectives."),
    slides: z.array(Slide).min(1),
    alignment: CurriculumAlignment.optional(),
    sources: z.array(SourceMaterial).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type Lesson = z.infer<typeof Lesson>;
