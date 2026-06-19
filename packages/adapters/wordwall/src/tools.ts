import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Quiz } from "@edu-agent-kit/core";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import {
  buildWordwallContent,
  type WordwallContentInput,
  type WordwallTemplate,
} from "./content.js";
import { getOembed } from "./oembed.js";

/** Slugify a title into a filesystem-safe base name. */
function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "wordwall-activity";
}

const templateEnum = z.enum([
  "quiz",
  "match_up",
  "anagram",
  "group_sort",
  "open_box_or_wheel",
]);

const pairSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

const groupSchema = z.object({
  name: z.string().min(1),
  items: z.array(z.string().min(1)).default([]),
});

const buildInputSchema = z.object({
  template: templateEnum.describe("Wordwall template family to prepare for."),
  title: z
    .string()
    .max(300)
    .optional()
    .describe("Activity title; also used for the output filename."),
  quiz: z
    .unknown()
    .optional()
    .describe(
      "A core Quiz object; validated with the core Quiz schema in-handler.",
    ),
  pairs: z
    .array(pairSchema)
    .optional()
    .describe("Explicit term/definition pairs (match_up)."),
  words: z
    .array(z.string().min(1))
    .optional()
    .describe("Explicit word/item list (anagram, open_box_or_wheel)."),
  groups: z
    .array(groupSchema)
    .optional()
    .describe("Explicit groups + items (group_sort)."),
  outputPath: z
    .string()
    .optional()
    .describe(
      "Base output path WITHOUT extension. If omitted, writes to " +
        "<cwd>/out/<slug>. A .csv and .txt are written alongside.",
    ),
});

const oembedInputSchema = z.object({
  activityUrl: z
    .string()
    .url()
    .describe("Published Wordwall activity URL, e.g. https://wordwall.net/resource/123"),
  format: z
    .enum(["json", "xml"])
    .default("json")
    .describe("oEmbed response format."),
});

/**
 * wordwall_build_activity_content — write paste-ready CSV + TXT for a template.
 *
 * Wordwall has no creation/import API; the teacher types items into the editor
 * by hand. This tool generates aids for that manual step and returns absolute
 * file paths.
 */
export const buildActivityContentTool: ToolDefinition<typeof buildInputSchema> =
  defineTool({
    name: "wordwall_build_activity_content",
    title: "Wordwall: build activity content (CSV + TXT)",
    description:
      "Generate paste-ready content files for a Wordwall template. " +
      "Wordwall has NO creation or bulk-import API — every item is entered " +
      "per-item in the web editor — so this writes a .csv and a readable .txt " +
      "to help with manual entry, and returns their absolute paths.",
    inputSchema: buildInputSchema,
    annotations: {
      title: "Wordwall: build activity content (CSV + TXT)",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async (args) => {
      try {
        const input: WordwallContentInput = {
          title: args.title,
          pairs: args.pairs,
          words: args.words,
          groups: args.groups,
        };

        if (args.quiz !== undefined) {
          const parsed = Quiz.safeParse(args.quiz);
          if (!parsed.success) {
            return errorResult(
              "Invalid `quiz`: " +
                parsed.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; "),
            );
          }
          input.quiz = parsed.data;
        }

        const { csv, txt, warnings } = buildWordwallContent(
          input,
          args.template as WordwallTemplate,
        );

        const base =
          args.outputPath ??
          path.join(
            process.cwd(),
            "out",
            slugify(args.title ?? input.quiz?.title ?? "wordwall-activity"),
          );
        const absBase = path.resolve(base);
        const csvPath = `${absBase}.csv`;
        const txtPath = `${absBase}.txt`;

        await fs.mkdir(path.dirname(absBase), { recursive: true });
        await fs.writeFile(csvPath, csv, "utf8");
        await fs.writeFile(txtPath, txt, "utf8");

        const md = [
          `# Wordwall content prepared (${args.template})`,
          "",
          `- CSV: \`${csvPath}\``,
          `- TXT: \`${txtPath}\``,
          "",
          "## Manual step (required)",
          "Wordwall has **no creation or bulk-import API**. Open Wordwall, " +
            `pick the **${args.template}** template, and paste each item ` +
            "individually from the .txt (or use the .csv as a reference).",
          ...(warnings.length > 0
            ? ["", "## Warnings", ...warnings.map((w) => `- ${w}`)]
            : []),
        ].join("\n");

        return dualResult(md, {
          template: args.template,
          csvPath,
          txtPath,
          warnings,
        });
      } catch (error) {
        return errorResult(handleApiError(error, "Wordwall"));
      }
    },
  });

/**
 * wordwall_get_oembed — read published activity metadata via the oEmbed API.
 * This is the only public read endpoint Wordwall exposes.
 */
export const getOembedTool: ToolDefinition<typeof oembedInputSchema> =
  defineTool({
    name: "wordwall_get_oembed",
    title: "Wordwall: get oEmbed metadata",
    description:
      "Fetch oEmbed metadata (title, embed html, thumbnail) for a published " +
      "Wordwall activity URL. Read-only; uses Wordwall's public oEmbed endpoint.",
    inputSchema: oembedInputSchema,
    annotations: {
      title: "Wordwall: get oEmbed metadata",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (args) => {
      try {
        const data = await getOembed(args.activityUrl, args.format);
        const md = [
          `# ${data.title ?? "Wordwall activity"}`,
          "",
          `- **type**: ${data.type}`,
          ...(data.author_name ? [`- **author**: ${data.author_name}`] : []),
          ...(data.thumbnail_url
            ? [`- **thumbnail**: ${data.thumbnail_url}`]
            : []),
          ...(data.html ? ["", "## Embed HTML", "```html", data.html, "```"] : []),
        ].join("\n");
        return dualResult(md, { oembed: data as Record<string, unknown> });
      } catch (error) {
        return errorResult(handleApiError(error, "Wordwall"));
      }
    },
  });

/** All Wordwall tool definitions, in registration order. */
export const wordwallTools: ToolDefinition[] = [
  buildActivityContentTool as unknown as ToolDefinition,
  getOembedTool as unknown as ToolDefinition,
];
