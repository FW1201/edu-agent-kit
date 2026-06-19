#!/usr/bin/env node
/**
 * One-time OAuth consent CLI for the Google Classroom adapter.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
 *     node packages/adapters/google-classroom/dist/auth-cli.js
 *
 * Delegates to the shared consent flow, requesting the Classroom scopes.
 */
import { runAuthFlow } from "@edu-agent-kit/google-shared";
import { SCOPES } from "./auth.js";

runAuthFlow(SCOPES).then(
  () => process.exit(0),
  (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nAuth CLI failed: ${message}\n`);
    process.exit(1);
  },
);
