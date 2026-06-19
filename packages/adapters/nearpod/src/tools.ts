import { z } from "zod";
import path from "node:path";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import { Lesson } from "@edu-agent-kit/core";
import { buildNearpodPptx } from "./pptx.js";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "lesson"
  );
}

const BuildExportInput = z
  .object({
    lesson: z
      .unknown()
      .describe("A Lesson object conforming to the core Lesson schema."),
    outputPath: z
      .string()
      .optional()
      .describe(
        "Where to write the .pptx. Defaults to ./out/<lesson-slug>.pptx under the current working directory.",
      ),
  })
  .strict();

export const buildSlidesExportTool = defineTool({
  name: "nearpod_build_slides_export",
  title: "Build Nearpod Slides Export (.pptx)",
  description: `Generate a Google Slides-compatible .pptx file from a Lesson for use in Nearpod.

Nearpod has no public content-creation API. The supported path is: generate this .pptx -> import it into Google Slides -> add it to a Nearpod lesson via the Nearpod Google Slides add-on (or upload the slides). This tool produces the high-fidelity slide deck; the import is a manual one-step action.

Args:
  - lesson (object): a Lesson (title, objectives[], slides[]). Slides may carry bullets, body, speakerNotes, and an embeddedQuestion.
  - outputPath (string, optional): destination .pptx path. Defaults to ./out/<slug>.pptx.

Returns (structuredContent): { outputPath: string, slideCount: number, nextSteps: string[] }.

Example:
  - Use after content_generate_lesson to turn a generated lesson into an importable deck.

Error handling:
  - Returns an error if 'lesson' does not match the Lesson schema (with the validation issues).`,
  inputSchema: BuildExportInput,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (args) => {
    const parsed = Lesson.safeParse(args.lesson);
    if (!parsed.success) {
      return errorResult(
        `Invalid lesson: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }
    const lesson = parsed.data;
    const outPath =
      args.outputPath ??
      path.join(process.cwd(), "out", `${slugify(lesson.title)}.pptx`);
    try {
      const result = await buildNearpodPptx(lesson, outPath);
      const nextSteps = [
        "Upload the .pptx to Google Drive and open it with Google Slides (or File > Import slides).",
        "In Nearpod, create/edit a lesson and use the Google Slides add-on, or add the slides to your Nearpod lesson.",
        "Add Nearpod interactive activities (Quiz, Poll, Open Ended) where the deck marks assessment slides.",
      ];
      const md = [
        `# Nearpod slides export ready`,
        ``,
        `**File:** ${result.path}`,
        `**Slides:** ${result.slideCount}`,
        ``,
        `## Next steps`,
        ...nextSteps.map((s, i) => `${i + 1}. ${s}`),
      ].join("\n");
      return dualResult(md, {
        outputPath: result.path,
        slideCount: result.slideCount,
        nextSteps,
      });
    } catch (err) {
      return errorResult(handleApiError(err, "Nearpod"));
    }
  },
});

export const nearpodToolList: ToolDefinition[] = [
  buildSlidesExportTool,
] as unknown as ToolDefinition[];
