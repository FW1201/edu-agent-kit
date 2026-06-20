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
import { buildTeachApp } from "./build.js";
import { deploySite } from "./deploy.js";
import type { FlashCard } from "./templates.js";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "app";
}

const BuildInput = z
  .object({
    template: z.enum(["quiz", "flashcards"]),
    quiz: z.unknown().optional().describe("Quiz object (required for the 'quiz' template)."),
    title: z.string().optional().describe("Title (flashcards)."),
    cards: z
      .array(z.object({ front: z.string(), back: z.string() }))
      .optional()
      .describe("Cards (required for the 'flashcards' template)."),
    outputDir: z.string().optional().describe("Output dir. Defaults ./out/app-<slug>."),
  })
  .strict();

export const teachappBuildTool = defineTool({
  name: "teachapp_build",
  title: "Build an Interactive Teaching App",
  description: `Build a self-contained interactive activity (single index.html, no build step) from generated content. Templates: 'quiz' (tap-to-answer with instant feedback + score) or 'flashcards' (flip cards). Then preview locally or deploy with teachapp_deploy.

Args: template ('quiz'|'flashcards'); quiz (for quiz); title + cards[{front,back}] (for flashcards); outputDir?.
Returns (structuredContent): { dir, indexPath }. No credentials needed.`,
  inputSchema: BuildInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args) => {
    try {
      let outDir = args.outputDir;
      if (args.template === "quiz") {
        const parsed = Quiz.safeParse(args.quiz);
        if (!parsed.success) {
          return errorResult(`Invalid quiz: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
        }
        outDir = outDir ?? path.join(process.cwd(), "out", `app-${slug(parsed.data.title)}`);
        const res = await buildTeachApp({ template: "quiz", quiz: parsed.data, outDir });
        return dualResult(`# 互動測驗已建立\n\n${res.indexPath}\n\n預覽：用瀏覽器開啟，或 teachapp_deploy 部署。`, res);
      }
      outDir = outDir ?? path.join(process.cwd(), "out", `app-${slug(args.title ?? "flashcards")}`);
      const res = await buildTeachApp({
        template: "flashcards",
        title: args.title,
        cards: (args.cards ?? []) as FlashCard[],
        outDir,
      });
      return dualResult(`# 閃卡已建立\n\n${res.indexPath}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "teach-apps"));
    }
  },
});

export const teachappDeployTool = defineTool({
  name: "teachapp_deploy",
  title: "Deploy an Interactive Teaching App",
  description: `Deploy a built teach-app directory and return the live URL.

Args: dir (string, from teachapp_build); target ('vercel'|'github-pages').
  - vercel: requires \`edu-agent-kit auth login vercel\` first.
  - github-pages: run inside a git repo with a GitHub remote (publishes to gh-pages).
For Firebase Hosting, use firebase_deploy_hosting with sourceDir = the build dir.
Returns (structuredContent): { url?, target }.`,
  inputSchema: z.object({ dir: z.string().min(1), target: z.enum(["vercel", "github-pages"]) }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    try {
      const res = await deploySite(args.dir, args.target);
      return dualResult(
        `# 已部署（${args.target}）\n\n${res.url ?? "(見輸出；GitHub Pages 網址依 repo Pages 設定)"}`,
        { url: res.url, target: args.target },
      );
    } catch (err) {
      return errorResult(handleApiError(err, "teach-apps"));
    }
  },
});

export const teachAppsToolList: ToolDefinition[] = [
  teachappBuildTool,
  teachappDeployTool,
] as unknown as ToolDefinition[];
