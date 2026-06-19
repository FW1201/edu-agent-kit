import { z } from "zod";
import { MediaRef } from "./common.js";
import { SourceMaterial } from "./source.js";

/** A single post/card on a collaborative board (Padlet). */
export const BoardPost = z
  .object({
    subject: z.string().max(300).optional().describe("Post title/heading."),
    body: z.string().max(8000).default("").describe("Post body content."),
    media: MediaRef.optional(),
    section: z
      .string()
      .max(200)
      .optional()
      .describe("Column/section label for sectioned boards."),
    color: z
      .enum(["red", "orange", "green", "blue", "purple"])
      .optional()
      .describe("Optional post color where supported."),
  })
  .strict();
export type BoardPost = z.infer<typeof BoardPost>;

/**
 * A collaborative board — produced for Padlet. `seedPosts` are starter cards
 * the agent generates to give the board pedagogical depth from the start.
 */
export const Board = z
  .object({
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional(),
    format: z
      .enum(["wall", "grid", "columns", "stream", "canvas"])
      .default("columns")
      .describe("Padlet layout format."),
    sections: z
      .array(z.string().min(1).max(200))
      .default([])
      .describe("Column/section labels for sectioned layouts."),
    seedPosts: z.array(BoardPost).default([]),
    sources: z.array(SourceMaterial).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type Board = z.infer<typeof Board>;
