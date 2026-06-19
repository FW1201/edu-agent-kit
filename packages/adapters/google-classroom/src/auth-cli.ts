#!/usr/bin/env node
/**
 * One-time OAuth consent CLI for the Google Classroom adapter.
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
 *     node packages/adapters/google-classroom/dist/auth-cli.js
 *
 * It prints a consent URL, starts a local HTTP server on the redirect port,
 * captures the `code` query parameter Google redirects back with, exchanges it
 * for tokens (access + refresh), persists them via JsonTokenStore, then exits.
 * Uses only Node built-ins plus googleapis.
 */
import http from "node:http";
import { URL } from "node:url";
import { createOAuthClient, getTokenStore, SCOPES, DEFAULT_REDIRECT_URI } from "./auth.js";
import { optionalEnv } from "@edu-agent-kit/mcp-shared";

function redirectInfo(): { redirectUri: string; host: string; port: number; pathname: string } {
  const redirectUri = optionalEnv("GOOGLE_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
  const parsed = new URL(redirectUri);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  return { redirectUri, host: parsed.hostname, port, pathname: parsed.pathname };
}

async function main(): Promise<void> {
  const oauth = createOAuthClient();
  const { port, pathname } = redirectInfo();

  const consentUrl = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  process.stdout.write("\nGoogle Classroom — OAuth setup\n");
  process.stdout.write("Open this URL in your browser and grant access:\n\n");
  process.stdout.write(`  ${consentUrl}\n\n`);
  process.stdout.write(`Waiting for the redirect on port ${port}...\n`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400).end("Missing request URL.");
          return;
        }
        const reqUrl = new URL(req.url, `http://localhost:${port}`);
        if (reqUrl.pathname !== pathname) {
          res.writeHead(404).end("Not found.");
          return;
        }
        const error = reqUrl.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain" }).end(`Authorization failed: ${error}`);
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }
        const authCode = reqUrl.searchParams.get("code");
        if (!authCode) {
          res.writeHead(400, { "Content-Type": "text/plain" }).end("No authorization code in redirect.");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
          "<html><body><h2>Google Classroom authorized.</h2><p>You can close this tab and return to the terminal.</p></body></html>",
        );
        server.close();
        resolve(authCode);
      } catch (err) {
        server.close();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    server.on("error", reject);
    server.listen(port);
  });

  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    process.stdout.write(
      "\nWarning: no refresh_token returned. Revoke prior access at " +
        "https://myaccount.google.com/permissions and re-run to force one.\n",
    );
  }
  await getTokenStore().write(tokens);
  process.stdout.write(`\nTokens saved. Setup complete.\n`);
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nAuth CLI failed: ${message}\n`);
    process.exit(1);
  },
);
