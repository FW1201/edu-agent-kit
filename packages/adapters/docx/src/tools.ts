import { z } from "zod";
import path from "node:path";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import { Lesson, Quiz } from "@edu-agent-kit/core";
import { buildLessonDoc, buildQuizDoc } from "./builders.js";
import { writeDocx } from "./writer.js";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "doc";
}

export const lessonDocxTool = defineTool({
  name: "docx_create_lesson",
  title: "Create Word (.docx) lesson handout",
  description: `Generate an editable Word (.docx) 講義 from a Lesson (title, objectives, alignment, slides incl. embedded questions + speaker notes).

Args: lesson (a core Lesson), outputPath? (defaults ./out/<slug>.docx).
Returns (structuredContent): { outputPath }. No credentials needed — fully offline.`,
  inputSchema: z.object({ lesson: z.unknown(), outputPath: z.string().optional() }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args) => {
    const parsed = Lesson.safeParse(args.lesson);
    if (!parsed.success) {
      return errorResult(`Invalid lesson: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    try {
      const out = args.outputPath ?? path.join(process.cwd(), "out", `${slug(parsed.data.title)}.docx`);
      const p = await writeDocx(buildLessonDoc(parsed.data), out);
      return dualResult(`# Word 講義已產出\n\n${p}`, { outputPath: p });
    } catch (err) {
      return errorResult(handleApiError(err, "docx"));
    }
  },
});

export const quizDocxTool = defineTool({
  name: "docx_create_quiz",
  title: "Create Word (.docx) quiz / worksheet",
  description: `Generate an editable Word (.docx) 測驗卷/學習單 from a Quiz, with a name/class header and (optionally) an answer key.

Args: quiz (a core Quiz), withAnswers? (boolean, default false → student version; true → teacher version with answer key), outputPath? (defaults ./out/<slug>.docx).
Returns (structuredContent): { outputPath }. No credentials needed — fully offline.`,
  inputSchema: z
    .object({ quiz: z.unknown(), withAnswers: z.boolean().default(false), outputPath: z.string().optional() })
    .strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args) => {
    const parsed = Quiz.safeParse(args.quiz);
    if (!parsed.success) {
      return errorResult(`Invalid quiz: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    try {
      const suffix = args.withAnswers ? "-teacher" : "";
      const out = args.outputPath ?? path.join(process.cwd(), "out", `${slug(parsed.data.title)}${suffix}.docx`);
      const p = await writeDocx(buildQuizDoc(parsed.data, args.withAnswers), out);
      return dualResult(`# Word ${args.withAnswers ? "測驗卷（含解答）" : "學習單"}已產出\n\n${p}`, { outputPath: p });
    } catch (err) {
      return errorResult(handleApiError(err, "docx"));
    }
  },
});

export const docxToolList: ToolDefinition[] = [lessonDocxTool, quizDocxTool] as unknown as ToolDefinition[];
