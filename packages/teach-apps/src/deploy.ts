import { spawn } from "node:child_process";
import { ToolError } from "@edu-agent-kit/mcp-shared";

export type DeployTarget = "vercel" | "github-pages";

function run(cmd: string, args: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (out += d.toString()));
    child.on("error", (e) => resolve({ code: 1, out: out + String(e) }));
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

/** Deploy a built site directory to Vercel (requires `vercel login` / auth login vercel). */
export async function deployVercel(dir: string): Promise<{ url: string; output: string }> {
  const { code, out } = await run("npx", ["--yes", "vercel", "--prod", "--yes"], dir);
  if (code !== 0) throw new ToolError(`Vercel deploy failed: ${out.slice(-800)}`);
  const url = out.match(/https:\/\/[^\s]+\.vercel\.app/)?.[0] ?? "";
  return { url, output: out };
}

/**
 * Publish a built site directory to GitHub Pages via the `gh-pages` tool.
 * Must be run inside a git repo with a GitHub remote; publishes to the gh-pages
 * branch. Returns the tool output (URL depends on the repo's Pages settings).
 */
export async function deployGithubPages(dir: string): Promise<{ output: string }> {
  const { code, out } = await run("npx", ["--yes", "gh-pages", "--dist", dir], process.cwd());
  if (code !== 0) throw new ToolError(`GitHub Pages deploy failed: ${out.slice(-800)}`);
  return { output: out };
}

export async function deploySite(
  dir: string,
  target: DeployTarget,
): Promise<{ url?: string; output: string }> {
  if (target === "vercel") return deployVercel(dir);
  return deployGithubPages(dir);
}
