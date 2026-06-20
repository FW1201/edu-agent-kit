import { promises as fs } from "node:fs";
import path from "node:path";
import { ToolError } from "@edu-agent-kit/mcp-shared";
import type { Quiz } from "@edu-agent-kit/core";
import { quizHtml, flashcardsHtml, type TeachAppTemplate, type FlashCard } from "./templates.js";

export interface BuildResult {
  dir: string;
  indexPath: string;
}

export interface BuildOptions {
  template: TeachAppTemplate;
  outDir: string;
  /** For the quiz template. */
  quiz?: Quiz;
  /** For the flashcards template. */
  title?: string;
  cards?: FlashCard[];
}

/**
 * Build a self-contained interactive teaching app into `outDir` (writes
 * index.html). Returns the directory + index path, ready to preview or deploy.
 */
export async function buildTeachApp(opts: BuildOptions): Promise<BuildResult> {
  let html: string;
  if (opts.template === "quiz") {
    if (!opts.quiz) throw new ToolError("The 'quiz' template requires a 'quiz' object.", 400);
    html = quizHtml(opts.quiz);
  } else if (opts.template === "flashcards") {
    if (!opts.cards || opts.cards.length === 0) {
      throw new ToolError("The 'flashcards' template requires a non-empty 'cards' array.", 400);
    }
    html = flashcardsHtml(opts.title ?? "Flashcards", opts.cards);
  } else {
    throw new ToolError(`Unknown template '${String(opts.template)}'.`, 400);
  }
  await fs.mkdir(opts.outDir, { recursive: true });
  const indexPath = path.join(opts.outDir, "index.html");
  await fs.writeFile(indexPath, html, "utf8");
  return { dir: opts.outDir, indexPath };
}
