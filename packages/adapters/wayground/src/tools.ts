import { z } from "zod";
import path from "node:path";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import { Quiz } from "@edu-agent-kit/core";
import { buildWaygroundWorkbook } from "./workbook.js";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "wayground"
  );
}

const BuildInput = z
  .object({
    quiz: z.unknown().describe("A Quiz object conforming to the core Quiz schema."),
    outputPath: z
      .string()
      .optional()
      .describe("Destination .xlsx path. Defaults to ./out/<slug>.xlsx."),
  })
  .strict();

export const buildImportSpreadsheetTool = defineTool({
  name: "wayground_build_import_spreadsheet",
  title: "Build Wayground/Quizizz Import Spreadsheet (.xlsx)",
  description: `Generate a Wayground (formerly Quizizz) importable .xlsx from a Quiz, matching their spreadsheet template (plain text only; max 1 image per question).

Wayground has no public content-creation API. Upload this file in Wayground: create a quiz > Import > Spreadsheet > Upload from device.

Args:
  - quiz (object): a Quiz (title, questions[]). Supported types map to Multiple Choice / Checkbox / Fill in the Blank / Open-Ended / Poll; others are skipped with warnings. Rich text is stripped to plain text.
  - outputPath (string, optional): .xlsx destination. Defaults to ./out/<slug>.xlsx.

Returns (structuredContent): { outputPath, questionCount, warnings[] }.

Error handling: returns validation issues if 'quiz' does not match the Quiz schema.`,
  inputSchema: BuildInput,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (args) => {
    const parsed = Quiz.safeParse(args.quiz);
    if (!parsed.success) {
      return errorResult(
        `Invalid quiz: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }
    const quiz = parsed.data;
    const outPath =
      args.outputPath ??
      path.join(process.cwd(), "out", `${slugify(quiz.title)}.xlsx`);
    try {
      const result = await buildWaygroundWorkbook(quiz, outPath);
      const md = [
        `# Wayground import spreadsheet ready`,
        ``,
        `**File:** ${result.path}`,
        `**Questions mapped:** ${result.questionCount}`,
        result.warnings.length
          ? `\n## Warnings\n${result.warnings.map((w) => `- ${w}`).join("\n")}`
          : ``,
        ``,
        `## Upload`,
        `In Wayground: create a quiz > Import > Spreadsheet > Upload from device > select this file.`,
      ].join("\n");
      return dualResult(md, {
        outputPath: result.path,
        questionCount: result.questionCount,
        warnings: result.warnings,
      });
    } catch (err) {
      return errorResult(handleApiError(err, "Wayground"));
    }
  },
});

// Note: Wayground/Quizizz exposes no documented public oEmbed/read API, so no
// read tool is provided (we do not invent unsupported endpoints).
export const waygroundToolList: ToolDefinition[] = [
  buildImportSpreadsheetTool,
] as unknown as ToolDefinition[];
