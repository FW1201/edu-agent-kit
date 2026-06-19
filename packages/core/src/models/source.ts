import { z } from "zod";

/** Origin of an ingested external resource. */
export const SourceOrigin = z.enum(["file", "url", "web_search", "manual"]);
export type SourceOrigin = z.infer<typeof SourceOrigin>;

/**
 * Structured representation of an external resource after ingestion.
 * This is the "外部資源容納" contract: every source becomes a SourceMaterial
 * that the generation layer consumes.
 */
export const SourceMaterial = z
  .object({
    id: z.string().min(1).describe("Stable id for referencing this material."),
    origin: SourceOrigin,
    title: z.string().max(300).optional(),
    locator: z
      .string()
      .max(2000)
      .optional()
      .describe("File path, URL, or search query that produced this material."),
    mimeType: z.string().max(120).optional(),
    text: z
      .string()
      .describe("Extracted plain-text content used as generation context."),
    excerpts: z
      .array(
        z.object({
          heading: z.string().max(300).optional(),
          text: z.string(),
        }),
      )
      .default([])
      .describe("Optional structured sections extracted from the source."),
    citations: z
      .array(
        z.object({
          label: z.string().max(300),
          url: z.string().url().optional(),
        }),
      )
      .default([])
      .describe("Traceable citations for content provenance."),
    retrievedAt: z
      .string()
      .describe("ISO-8601 timestamp of when the material was ingested."),
  })
  .strict();
export type SourceMaterial = z.infer<typeof SourceMaterial>;
