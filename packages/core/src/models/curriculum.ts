import { z } from "zod";
import { BloomLevel, GradeLevel } from "./common.js";

/**
 * Curriculum alignment metadata. Defaults target Taiwan's 108 課綱 but the
 * framework field is free-form so other standards (CCSS, IB, etc.) fit too.
 */
export const CurriculumAlignment = z
  .object({
    framework: z
      .string()
      .default("108課綱")
      .describe("Curriculum framework, e.g. '108課綱', 'CCSS', 'IB'."),
    gradeLevel: GradeLevel,
    domain: z
      .string()
      .max(80)
      .describe("Subject domain, e.g. '國語文', '數學', '自然科學', 'English'."),
    learningObjectives: z
      .array(z.string().min(1).max(500))
      .default([])
      .describe("Specific learning objectives / 學習表現 codes or statements."),
    coreCompetencies: z
      .array(z.string().min(1).max(300))
      .default([])
      .describe("核心素養 statements this content cultivates."),
    bloomFocus: z
      .array(BloomLevel)
      .default([])
      .describe("Target Bloom levels emphasized by this content."),
  })
  .strict();
export type CurriculumAlignment = z.infer<typeof CurriculumAlignment>;
