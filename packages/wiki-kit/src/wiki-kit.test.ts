import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { scaffoldWiki, listTemplates } from "./index.js";

const tmp = path.join(os.tmpdir(), `wiki-kit-test-${Date.now()}`);

async function read(p: string): Promise<string> {
  return fs.readFile(p, "utf8");
}

describe("listTemplates", () => {
  it("ships the two chosen templates", () => {
    const ids = listTemplates().map((t) => t.id);
    expect(ids).toContain("workflow");
    expect(ids).toContain("minimal");
  });
});

describe("scaffoldWiki", () => {
  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("creates the workflow tree + core files + selected agent memory files", async () => {
    const target = path.join(tmp, "workflow");
    const res = await scaffoldWiki({
      targetDir: target,
      templateId: "workflow",
      profile: {
        teacherName: "吳老師",
        gradeLevels: ["國中"],
        subjects: ["數學"],
        platforms: ["kahoot"],
        googleServices: ["docs", "classroom"],
        agents: ["claude", "codex", "cursor"],
      },
    });
    expect(res.createdFiles).toContain("WIKI.md");
    expect(res.createdFiles).toContain("CLAUDE.md");
    expect(res.createdFiles).toContain("AGENTS.md");
    expect(res.createdFiles).toContain(".cursor/rules/edu-agent-kit.mdc");

    // Folder tree
    const stat = await fs.stat(path.join(target, "raw", "備課"));
    expect(stat.isDirectory()).toBe(true);

    // WIKI.md reflects profile + dispatch commands
    const wiki = await read(path.join(target, "WIKI.md"));
    expect(wiki).toContain("吳老師");
    expect(wiki).toContain("ingest <path>");

    // .mcp.json wires the server
    const mcp = JSON.parse(await read(path.join(target, ".mcp.json")));
    expect(mcp.mcpServers["edu-agent-kit"].command).toBe("edu-agent-kit-server");

    // Cursor rule has frontmatter
    const rule = await read(path.join(target, ".cursor/rules/edu-agent-kit.mdc"));
    expect(rule.startsWith("---")).toBe(true);
  });

  it("minimal template skips existing files on re-run", async () => {
    const target = path.join(tmp, "minimal");
    await scaffoldWiki({ targetDir: target, templateId: "minimal", profile: { agents: ["claude"] } });
    const second = await scaffoldWiki({ targetDir: target, templateId: "minimal", profile: { agents: ["claude"] } });
    expect(second.skipped).toContain("WIKI.md");
  });
});
