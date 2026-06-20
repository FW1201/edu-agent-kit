#!/usr/bin/env node
/**
 * edu-agent-kit CLI — cross-agent companion to the MCP server.
 *
 *   edu-agent-kit init [--dir .] [--template workflow|minimal] [flags]
 *   edu-agent-kit auth google [--services docs,slides,...]
 *   edu-agent-kit auth status
 *   edu-agent-kit export <doc|slides|form|sheet|drive|firebase> [flags]
 *   edu-agent-kit doctor
 */
import { runInit } from "./init.js";
import { runAuthLogin, runAuthLogout, runAuthStatus, runAuthGoogle } from "./auth.js";
import { runExport } from "./export.js";
import { runDoctor } from "./doctor.js";

const HELP = `edu-agent-kit — educator knowledge-base & content toolkit

Usage:
  edu-agent-kit init [--dir .] [--template workflow|minimal] [--name ..] [--grades ..] [--subjects ..] [--agents claude,codex,..] [--platforms ..] [--google docs,slides,..] [--yes]
  edu-agent-kit auth login [google|padlet|kahoot|firebase|vercel]   (opens browser; one-time, permanent until logout)
  edu-agent-kit auth logout [google|padlet|kahoot|firebase|vercel]
  edu-agent-kit auth status
  edu-agent-kit export <doc|slides|form|sheet|drive|firebase> [--lesson f.json|--quiz f.json|--file path|--html f.html] [--title ..] [--project ..]
  edu-agent-kit doctor
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  switch (command) {
    case "init":
      await runInit(argv.slice(1));
      break;
    case "auth": {
      const sub = argv[1];
      if (sub === "login") await runAuthLogin(argv.slice(2));
      else if (sub === "logout") await runAuthLogout(argv.slice(2));
      else if (sub === "google") await runAuthGoogle(argv.slice(2));
      else if (sub === "status") await runAuthStatus();
      else process.stdout.write(HELP);
      break;
    }
    case "export":
      await runExport(argv.slice(1));
      break;
    case "doctor":
      await runDoctor();
      break;
    case "-h":
    case "--help":
    case undefined:
      process.stdout.write(HELP);
      break;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
