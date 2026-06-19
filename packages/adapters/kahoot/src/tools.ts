import { z } from "zod";
import path from "node:path";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@interactive-edtech/mcp-shared";
import { Quiz } from "@interactive-edtech/core";
import { buildKahootWorkbook } from "./workbook.js";
import { getReport, listReports, analyzeReport } from "./reports.js";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "kahoot"
  );
}

const BuildXlsxInput = z
  .object({
    quiz: z.unknown().describe("A Quiz object conforming to the core Quiz schema."),
    outputPath: z
      .string()
      .optional()
      .describe("Destination .xlsx path. Defaults to ./out/<slug>.xlsx."),
    defaultTimeLimitSeconds: z
      .number()
      .int()
      .optional()
      .describe("Default per-question time limit; snapped to a valid Kahoot value."),
  })
  .strict();

export const buildImportXlsxTool = defineTool({
  name: "kahoot_build_import_xlsx",
  title: "Build Kahoot Import Workbook (.xlsx)",
  description: `Generate a Kahoot-importable .xlsx workbook from a Quiz, matching Kahoot's official spreadsheet template.

Kahoot has no content-creation API; this produces the official import workbook. Upload it in Kahoot: Create > Add question > Import spreadsheet.

Args:
  - quiz (object): a Quiz (title, questions[]). Only multiple_choice/multiple_select/true_false map; other types are skipped with warnings.
  - outputPath (string, optional): .xlsx destination. Defaults to ./out/<slug>.xlsx.
  - defaultTimeLimitSeconds (number, optional): default time limit (snapped to 5/10/20/30/60/90/120/240).

Returns (structuredContent): { outputPath, questionCount, warnings[] }.

Error handling: returns the validation issues if 'quiz' does not match the Quiz schema.`,
  inputSchema: BuildXlsxInput,
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
      const result = await buildKahootWorkbook(quiz, outPath, {
        defaultTimeLimitSeconds: args.defaultTimeLimitSeconds,
      });
      const md = [
        `# Kahoot import workbook ready`,
        ``,
        `**File:** ${result.path}`,
        `**Questions mapped:** ${result.questionCount}`,
        result.warnings.length
          ? `\n## Warnings\n${result.warnings.map((w) => `- ${w}`).join("\n")}`
          : ``,
        ``,
        `## Upload`,
        `In Kahoot: Create a kahoot > Add question > Import > Import spreadsheet > upload this file.`,
      ].join("\n");
      return dualResult(md, {
        outputPath: result.path,
        questionCount: result.questionCount,
        warnings: result.warnings,
      });
    } catch (err) {
      return errorResult(handleApiError(err, "Kahoot"));
    }
  },
});

const GetReportInput = z
  .object({
    reportId: z
      .string()
      .optional()
      .describe("Report/session id. Omit to list recent reports instead."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Max reports to list when reportId is omitted."),
    response_format: z
      .enum(["markdown", "json"])
      .default("markdown")
      .describe("Output format: 'markdown' or 'json'."),
  })
  .strict();

export const getReportTool = defineTool({
  name: "kahoot_get_report",
  title: "Get Kahoot Report (read-only)",
  description: `Fetch a Kahoot game report by id, or list recent reports when no id is given. Read-only; requires KAHOOT_API_KEY (EDU/enterprise).

Args:
  - reportId (string, optional): a report/session id; omit to list recent reports.
  - limit (number): max reports when listing (default 20).
  - response_format ('markdown'|'json').

Returns: the raw report payload (or list). Use kahoot_analyze_results to summarize a report.

Error handling: returns an auth error if KAHOOT_API_KEY is missing or the plan lacks Reports API access.`,
  inputSchema: GetReportInput,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (args) => {
    try {
      const data = args.reportId
        ? await getReport(args.reportId)
        : await listReports(args.limit);
      const json = JSON.stringify(data, null, 2);
      if (args.response_format === "json") {
        return dualResult(json, { report: data });
      }
      return dualResult(
        `# Kahoot ${args.reportId ? `report ${args.reportId}` : "recent reports"}\n\n\`\`\`json\n${json.slice(0, 8000)}\n\`\`\``,
        { report: data },
      );
    } catch (err) {
      return errorResult(handleApiError(err, "Kahoot"));
    }
  },
});

const AnalyzeInput = z
  .object({
    reportId: z
      .string()
      .optional()
      .describe("Report id to fetch and analyze."),
    report: z
      .unknown()
      .optional()
      .describe("A previously fetched report payload to analyze directly."),
  })
  .strict();

export const analyzeResultsTool = defineTool({
  name: "kahoot_analyze_results",
  title: "Analyze Kahoot Results (read-only)",
  description: `Summarize a Kahoot report: participant count, average score, and per-question correctness. Pass either reportId (fetched via the Reports API) or a report payload directly.

Args:
  - reportId (string, optional): fetch then analyze (requires KAHOOT_API_KEY).
  - report (object, optional): analyze a payload you already fetched.

Returns (structuredContent): { participants, averageScore, perQuestion: [{index, title?, correctPct}] }.`,
  inputSchema: AnalyzeInput,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (args) => {
    try {
      const payload = args.report ?? (args.reportId ? await getReport(args.reportId) : undefined);
      if (payload === undefined) {
        return errorResult("Provide either 'reportId' or 'report'.");
      }
      const summary = analyzeReport(payload);
      const md = [
        `# Kahoot results summary`,
        ``,
        `- **Participants:** ${summary.participants}`,
        `- **Average score:** ${summary.averageScore ?? "n/a"}`,
        ``,
        `## Per-question correctness`,
        ...summary.perQuestion.map(
          (q) => `${q.index}. ${q.title ?? "(question)"} — ${q.correctPct ?? "n/a"}%`,
        ),
      ].join("\n");
      return dualResult(md, { summary: summary as unknown as Record<string, unknown> });
    } catch (err) {
      return errorResult(handleApiError(err, "Kahoot"));
    }
  },
});

export const kahootToolList: ToolDefinition[] = [
  buildImportXlsxTool,
  getReportTool,
  analyzeResultsTool,
] as unknown as ToolDefinition[];
