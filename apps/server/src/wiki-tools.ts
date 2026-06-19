import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import {
  scaffoldWiki,
  listTemplates,
  ALL_AGENTS,
  type AgentId,
} from "@edu-agent-kit/wiki-kit";

export const listTemplatesTool = defineTool({
  name: "wiki_list_templates",
  title: "List Wiki Templates",
  description: `List the available LLM-wiki structure templates for educators.

Returns (structuredContent): { templates: [{ id, title, description }] }.`,
  inputSchema: z.object({}).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const templates = listTemplates().map((t) => ({ id: t.id, title: t.title, description: t.description }));
    const md = ["# Wiki templates", "", ...templates.map((t) => `- **${t.id}** — ${t.title}: ${t.description}`)].join("\n");
    return dualResult(md, { templates });
  },
});

export const scaffoldTool = defineTool({
  name: "wiki_scaffold",
  title: "Scaffold Educator Knowledge Base",
  description: `Create a local LLM-wiki knowledge base for an educator (folder tree + WIKI.md + agent memory/core files + .mcp.json).

Args:
  - targetDir (string): where to create it.
  - templateId ('workflow' | 'minimal', default 'workflow').
  - teacherName?, gradeLevels?[], subjects?[], platforms?[], googleServices?[]
  - agents?: which agents to generate memory files for (claude/codex/opencode/gemini/cursor); default ['claude'].
  - overwrite?: overwrite existing files (default false).

Returns (structuredContent): { targetDir, templateId, createdDirs, createdFiles, skipped }.`,
  inputSchema: z
    .object({
      targetDir: z.string().min(1),
      templateId: z.enum(["workflow", "minimal"]).default("workflow"),
      teacherName: z.string().optional(),
      gradeLevels: z.array(z.string()).optional(),
      subjects: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
      googleServices: z.array(z.string()).optional(),
      agents: z.array(z.enum(ALL_AGENTS as [AgentId, ...AgentId[]])).optional(),
      overwrite: z.boolean().default(false),
    })
    .strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (args) => {
    try {
      const res = await scaffoldWiki({
        targetDir: args.targetDir,
        templateId: args.templateId,
        overwrite: args.overwrite,
        profile: {
          teacherName: args.teacherName,
          gradeLevels: args.gradeLevels,
          subjects: args.subjects,
          platforms: args.platforms,
          googleServices: args.googleServices,
          agents: args.agents ?? ["claude"],
        },
      });
      const md = [
        `# Knowledge base created at ${res.targetDir}`,
        `- Template: ${res.templateId}`,
        `- Dirs: ${res.createdDirs.length}, Files: ${res.createdFiles.length}, Skipped: ${res.skipped.length}`,
      ].join("\n");
      return dualResult(md, res as unknown as Record<string, unknown>);
    } catch (err) {
      return errorResult(handleApiError(err, "wiki-kit"));
    }
  },
});

export const wikiStatusTool = defineTool({
  name: "wiki_status",
  title: "Knowledge Base Status",
  description: `Summarize a knowledge base: number of wiki pages and the most recent log entries.

Args: wikiRoot (string) — the knowledge base directory (containing wiki/).
Returns (structuredContent): { pageCount, recentLog }.`,
  inputSchema: z.object({ wikiRoot: z.string().min(1) }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args) => {
    try {
      const wikiDir = path.join(args.wikiRoot, "wiki");
      let pageCount = 0;
      async function walk(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) await walk(full);
          else if (e.name.endsWith(".md") && e.name !== "log.md" && e.name !== "index.md") pageCount += 1;
        }
      }
      await walk(wikiDir).catch(() => undefined);
      let recentLog = "";
      try {
        const log = await fs.readFile(path.join(wikiDir, "log.md"), "utf8");
        recentLog = log.split("\n").slice(-12).join("\n");
      } catch {
        recentLog = "(no log.md found)";
      }
      const md = [`# Knowledge base status`, ``, `- Pages: ${pageCount}`, ``, `## Recent log`, recentLog].join("\n");
      return dualResult(md, { pageCount, recentLog });
    } catch (err) {
      return errorResult(handleApiError(err, "wiki-kit"));
    }
  },
});

export const wikiTools: ToolDefinition[] = [
  listTemplatesTool,
  scaffoldTool,
  wikiStatusTool,
] as unknown as ToolDefinition[];
