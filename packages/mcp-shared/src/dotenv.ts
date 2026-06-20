import { config } from "dotenv";

/**
 * Load `.env` from the current working directory into process.env. Must be
 * called explicitly (and early) by each entrypoint (CLI, server) — this
 * library deliberately has no import-time side effects. Existing process.env
 * values always win (dotenv default), so explicit shell/MCP-host env still
 * takes priority over a checked-in .env file.
 */
export function loadDotEnv(): void {
  config();
}
