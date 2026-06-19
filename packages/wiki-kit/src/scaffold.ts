import { promises as fs } from "node:fs";
import path from "node:path";
import { getTemplate } from "./templates.js";
import {
  wikiMd,
  indexMd,
  logMd,
  manifestJson,
  memorySeed,
  mcpJson,
  agentFiles,
} from "./content.js";
import type { ScaffoldOptions, ScaffoldResult } from "./types.js";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scaffold an LLM-wiki knowledge base for an educator: create the template's
 * folder tree (+ extras), then write WIKI.md, the wiki index/log, manifest,
 * a seed memory, .mcp.json, and the selected agents' memory/core files.
 * Safe by default: existing files are skipped unless `overwrite` is true.
 */
export async function scaffoldWiki(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const template = getTemplate(options.templateId);
  if (!template) {
    throw new Error(`Unknown template '${options.templateId}'. Use listTemplates() to see options.`);
  }
  const result: ScaffoldResult = {
    targetDir: options.targetDir,
    templateId: template.id,
    createdDirs: [],
    createdFiles: [],
    skipped: [],
  };

  const folders = [...template.folders, ...(options.extraFolders ?? [])];
  await fs.mkdir(options.targetDir, { recursive: true });
  for (const rel of folders) {
    const dir = path.join(options.targetDir, rel);
    if (!(await exists(dir))) {
      await fs.mkdir(dir, { recursive: true });
      result.createdDirs.push(rel);
    }
  }

  const files: { path: string; content: string }[] = [
    { path: "WIKI.md", content: wikiMd(template, options.profile) },
    { path: "wiki/index.md", content: indexMd(template) },
    { path: "wiki/log.md", content: logMd() },
    { path: ".cache/ingest-manifest.json", content: manifestJson() },
    { path: "memory/teacher-profile.md", content: memorySeed(options.profile) },
    { path: ".mcp.json", content: mcpJson() },
    ...agentFiles(options.profile, template),
  ];

  for (const f of files) {
    const full = path.join(options.targetDir, f.path);
    if (!options.overwrite && (await exists(full))) {
      result.skipped.push(f.path);
      continue;
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, f.content, "utf8");
    result.createdFiles.push(f.path);
  }

  return result;
}
