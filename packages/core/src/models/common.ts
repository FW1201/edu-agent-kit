import { z } from "zod";

/**
 * Bloom's taxonomy cognitive levels, ordered from lowest to highest.
 * Used to drive depth in generated content (the core value proposition:
 * native platform AI tends to cluster at remember/understand).
 */
export const BloomLevel = z.enum([
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);
export type BloomLevel = z.infer<typeof BloomLevel>;

/** ISO-639-1-ish language code plus the common zh-TW default for this project. */
export const LanguageCode = z
  .string()
  .min(2)
  .max(10)
  .describe("Language code, e.g. 'zh-TW', 'en', 'ja'. Defaults to 'zh-TW'.");

/** A grade band label. Free-form to support TW (國小/國中/高中) and K-12 numerics. */
export const GradeLevel = z
  .string()
  .min(1)
  .max(40)
  .describe("Grade level/band, e.g. '國小五年級', 'Grade 7', '高中一年級'.");

/** Reference to an external media asset attached to content. */
export const MediaRef = z
  .object({
    kind: z.enum(["image", "video", "audio", "link", "drive_file", "youtube"]),
    url: z.string().url().describe("Publicly reachable URL or resource URI."),
    title: z.string().max(300).optional(),
    altText: z.string().max(500).optional().describe("Accessibility alt text."),
  })
  .strict();
export type MediaRef = z.infer<typeof MediaRef>;

/** Difficulty hint, independent from Bloom level. */
export const Difficulty = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof Difficulty>;

/** Output format shared by all MCP tools. */
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}
export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe(
    "Output format: 'markdown' for human-readable or 'json' for machine-readable",
  );
