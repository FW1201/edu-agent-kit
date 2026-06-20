/**
 * Shared Google OAuth2 plumbing used by every Google adapter.
 *
 * Auth UX goal: `edu-agent-kit auth login` opens the browser once and the user
 * stays logged in until `auth logout`. Client credentials resolve in this order:
 *   1. GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (env)
 *   2. a client_secret.json (GOOGLE_CLIENT_SECRET_FILE env, or a bundled default)
 * For API calls the authorized client resolves in this order:
 *   1. stored OAuth token (from the login flow)
 *   2. service account / ADC (GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC) — for schools
 */
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath, URL } from "node:url";
import { google, type Auth } from "googleapis";
import {
  JsonTokenStore,
  optionalEnv,
  MissingCredentialError,
  openBrowser,
} from "@edu-agent-kit/mcp-shared";
import { scopesFor } from "./scopes.js";

export type OAuth2Client = Auth.OAuth2Client;
export type Credentials = Auth.Credentials;

/** Default redirect URI used by both the OAuth client and the consent server. */
export const DEFAULT_REDIRECT_URI = "http://localhost:3000/oauth2callback";

export function tokenStorePath(): string {
  return optionalEnv("GOOGLE_TOKEN_PATH") ?? `${process.cwd()}/.tokens/google-token.json`;
}

export function getTokenStore(): JsonTokenStore<Credentials> {
  return new JsonTokenStore<Credentials>(tokenStorePath());
}

interface ClientCreds {
  clientId: string;
  clientSecret: string;
}

/** Parse a Google client_secret.json ({installed|web:{client_id,client_secret}}). */
function parseClientSecretJson(raw: string): ClientCreds | undefined {
  try {
    const j = JSON.parse(raw) as Record<string, { client_id?: string; client_secret?: string }>;
    const node = j.installed ?? j.web;
    if (node?.client_id && node?.client_secret) {
      return { clientId: node.client_id, clientSecret: node.client_secret };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Resolve OAuth client credentials. A bundled default client (shipped by the
 * project so teachers need no Cloud Console) is used if present; env always wins.
 */
function resolveClientCreds(): ClientCreds {
  const envId = optionalEnv("GOOGLE_CLIENT_ID");
  const envSecret = optionalEnv("GOOGLE_CLIENT_SECRET");
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };

  // A downloaded client_secret.json (env path or bundled default).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    optionalEnv("GOOGLE_CLIENT_SECRET_FILE"),
    // bundled default shipped with the package (maintainer-provided, see docs)
    path.join(here, "..", "default-google-client.json"),
    path.join(here, "default-google-client.json"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  for (const file of candidates) {
    try {
      const creds = parseClientSecretJson(readFileSync(file, "utf8"));
      if (creds) return creds;
    } catch {
      /* try next */
    }
  }
  throw new MissingCredentialError(
    "GOOGLE_CLIENT_ID",
    "No Google OAuth client configured. Either the bundled default client is missing, or set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET_FILE to a downloaded client_secret.json). See docs/API-SETUP.md.",
  );
}

/** Construct an OAuth2 client (no token loaded). */
export function createOAuthClient(): OAuth2Client {
  const { clientId, clientSecret } = resolveClientCreds();
  const redirectUri = optionalEnv("GOOGLE_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Build an authenticated client for API calls. Prefers the stored OAuth token
 * (interactive login); falls back to service account / ADC for institutions.
 */
export async function getAuthorizedClient(): Promise<OAuth2Client> {
  const store = getTokenStore();
  const token = await store.read();
  if (token && (token.access_token || token.refresh_token)) {
    const auth = createOAuthClient();
    auth.setCredentials(token);
    auth.on("tokens", (refreshed: Credentials) => {
      void (async () => {
        try {
          await store.write({ ...token, ...refreshed });
        } catch {
          /* best-effort */
        }
      })();
    });
    return auth;
  }

  // Fallback: service account (GOOGLE_APPLICATION_CREDENTIALS) or gcloud ADC.
  // The ADC client is structurally compatible with the Google API factories
  // for making calls; cast to keep adapter call sites typed as OAuth2Client.
  try {
    const googleAuth = new google.auth.GoogleAuth({ scopes: scopesFor() });
    return (await googleAuth.getClient()) as unknown as OAuth2Client;
  } catch {
    throw new MissingCredentialError(
      "GOOGLE_TOKEN",
      "Not authorized. Run `edu-agent-kit auth login` (opens your browser, one-time). Schools can instead set GOOGLE_APPLICATION_CREDENTIALS to a service-account key.",
    );
  }
}

/** Whether a login token is currently stored. */
export async function isLoggedIn(): Promise<boolean> {
  const token = await getTokenStore().read();
  return Boolean(token && (token.access_token || token.refresh_token));
}

/** Delete the stored Google token (logout). Returns true if a token was removed. */
export async function logout(): Promise<boolean> {
  const p = tokenStorePath();
  try {
    await fs.unlink(p);
    return true;
  } catch {
    return false;
  }
}

function redirectInfo(): { port: number; pathname: string } {
  const redirectUri = optionalEnv("GOOGLE_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
  const parsed = new URL(redirectUri);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  return { port, pathname: parsed.pathname };
}

/**
 * Run the one-time consent flow for the given scopes (default: all services):
 * builds the consent URL, AUTO-OPENS the browser (prints URL as fallback),
 * captures the redirect code, exchanges it for tokens, and persists them.
 */
export async function runAuthFlow(
  scopes: string[] = scopesFor(),
  log: (msg: string) => void = (m) => process.stdout.write(m),
): Promise<Credentials> {
  const oauth = createOAuthClient();
  const { port, pathname } = redirectInfo();

  const consentUrl = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  log("\nGoogle 授權 / authorization — opening your browser…\n");
  log("If it doesn't open, paste this URL manually:\n\n");
  log(`  ${consentUrl}\n\n`);
  openBrowser(consentUrl);
  log(`Waiting for the redirect on port ${port}…\n`);

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
          "<html><body style='font-family:sans-serif'><h2>✅ 已授權，可以關閉此分頁回到終端機。</h2></body></html>",
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
    log(
      "\nWarning: no refresh_token returned. Revoke prior access at " +
        "https://myaccount.google.com/permissions and re-run to force one.\n",
    );
  }
  await getTokenStore().write(tokens);
  log("\n✅ 登入完成，已永久保存（除非執行 auth logout）。\n");
  return tokens;
}
