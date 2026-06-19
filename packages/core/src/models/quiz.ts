import { z } from "zod";
import { LanguageCode, GradeLevel } from "./common.js";
import { Question } from "./question.js";
import { CurriculumAlignment } from "./curriculum.js";
import { SourceMaterial } from "./source.js";

/**
 * A quiz / assessment — the canonical structure produced by the generation
 * layer and consumed by Kahoot, Wayground, Wordwall and Classroom adapters.
 */
export const Quiz = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional(),
    subject: z.string().max(120).optional(),
    gradeLevel: GradeLevel.optional(),
    language: LanguageCode.default("zh-TW"),
    questions: z.array(Question).min(1),
    alignment: CurriculumAlignment.optional(),
    /** Provenance: which ingested materials this quiz was generated from. */
    sources: z.array(SourceMaterial).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type Quiz = z.infer<typeof Quiz>;
