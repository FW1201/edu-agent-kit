import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ToolError } from "@edu-agent-kit/mcp-shared";

/** The firebase.json hosting config object (pure, testable). */
export function buildFirebaseJson(): {
  hosting: { public: string; ignore: string[] };
} {
  return {
    hosting: {
      public: "public",
      ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
    },
  };
}

export interface PrepareInput {
  /** Inline HTML to publish as index.html (provide this OR sourceDir). */
  html?: string;
  /** A local directory to publish as-is (provide this OR html). */
  sourceDir?: string;
  /** Where to assemble the deployable site (a temp dir is fine). */
  siteDir: string;
  /** Firebase project id. */
  projectId: string;
}

/**
 * Assemble a deployable Firebase Hosting site directory: writes public/ content
 * (from `html` or by copying `sourceDir`), plus firebase.json and .firebaserc.
 * Returns the site and public directory paths.
 */
export async function prepareHostingSite(
  input: PrepareInput,
): Promise<{ siteDir: string; publicDir: string }> {
  if (!input.html && !input.sourceDir) {
    throw new ToolError("Provide either 'html' or 'sourceDir'.", 400);
  }
  const publicDir = path.join(input.siteDir, "public");
  await fs.mkdir(publicDir, { recursive: true });

  if (input.html) {
    await fs.writeFile(path.join(publicDir, "index.html"), input.html, "utf8");
  } else if (input.sourceDir) {
    await fs.cp(input.sourceDir, publicDir, { recursive: true });
  }

  await fs.writeFile(
    path.join(input.siteDir, "firebase.json"),
    JSON.stringify(buildFirebaseJson(), null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(input.siteDir, ".firebaserc"),
    JSON.stringify({ projects: { default: input.projectId } }, null, 2),
    "utf8",
  );
  return { siteDir: input.siteDir, publicDir };
}

/**
 * Deploy an assembled site dir to Firebase Hosting via firebase-tools (run
 * through npx). Requires a CI token. Returns the live hosting URL.
 */
export async function deployHosting(opts: {
  siteDir: string;
  projectId: string;
  token: string;
}): Promise<{ url: string; output: string }> {
  const args = [
    "--yes",
    "firebase-tools",
    "deploy",
    "--only",
    "hosting",
    "--project",
    opts.projectId,
    "--token",
    opts.token,
    "--non-interactive",
  ];
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn("npx", args, { cwd: opts.siteDir, env: process.env });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d.toString()));
    child.stderr.on("data", (d) => (buf += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(buf);
      else reject(new ToolError(`firebase deploy failed (exit ${code}): ${buf.slice(-800)}`));
    });
  });
  // Prefer the URL firebase prints; fall back to the default web.app domain.
  const match = output.match(/https:\/\/[^\s]+\.web\.app/);
  const url = match ? match[0] : `https://${opts.projectId}.web.app`;
  return { url, output };
}
