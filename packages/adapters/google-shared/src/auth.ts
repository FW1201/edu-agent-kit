/**
 * Shared Google OAuth2 plumbing used by every Google adapter.
 *
 * Credentials come from env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET); the
 * refresh/access token is persisted by a JsonTokenStore and created once by the
 * consent flow (`runAuthFlow`, exposed via the CLI `auth google`).
 */
import http from "node:http";
import { URL } from "node:url";
import { google, type Auth } from "googleapis";
import {
  JsonTokenStore,
  optionalEnv,
  requireEnv,
  MissingCredentialError,
} from "@edu-agent-kit/mcp-shared";

export type OAuth2Client = Auth.OAuth2Client;
export type Credentials = Auth.Credentials;

/** Default redirect URI used by both the OAuth client and the consent server. */
export const DEFAULT_REDIRECT_URI = "http://localhost:3000/oauth2callback";

/** Resolve the token-store path from env (or a sensible default). */
export function tokenStorePath(): string {
  return optionalEnv("GOOGLE_TOKEN_PATH") ?? `${process.cwd()}/.tokens/google-token.json`;
}

/** A JsonTokenStore typed for Google OAuth credentials. */
export function getTokenStore(): JsonTokenStore<Credentials> {
  return new JsonTokenStore<Credentials>(tokenStorePath());
}

/** Construct an OAuth2 client from env (no token loaded). */
export function createOAuthClient(): OAuth2Client {
  const clientId = requireEnv(
    "GOOGLE_CLIENT_ID",
    "Create an OAuth client (Desktop) in Google Cloud Console with the needed APIs enabled.",
  );
  const clientSecret = requireEnv(
    "GOOGLE_CLIENT_SECRET",
    "Copy the client secret from the same OAuth client.",
  );
  const redirectUri = optionalEnv("GOOGLE_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Build an authenticated OAuth2 client: loads the persisted token, applies it,
 * and persists refreshed tokens. Throws MissingCredentialError if no token is
 * stored yet. Use the returned client with any `google.<api>({ auth })`.
 */
export async function getAuthorizedClient(): Promise<OAuth2Client> {
  const auth = createOAuthClient();
  const store = getTokenStore();
  const token = await store.read();
  if (!token || (!token.access_token && !token.refresh_token)) {
    throw new MissingCredentialError(
      "GOOGLE_TOKEN",
      "Authorize first: run `edu-agent-kit auth google` (or the adapter's auth-cli).",
    );
  }
  auth.setCredentials(token);
  auth.on("tokens", (refreshed: Credentials) => {
    void (async () => {
      try {
        await store.write({ ...token, ...refreshed });
      } catch {
        // Best-effort persistence; a failed write must not break the API call.
      }
    })();
  });
  return auth;
}

function redirectInfo(): { port: number; pathname: string } {
  const redirectUri = optionalEnv("GOOGLE_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
  const parsed = new URL(redirectUri);
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  return { port, pathname: parsed.pathname };
}

/**
 * Run the one-time consent flow for the given scopes: prints a consent URL,
 * starts a local server on the redirect port, captures the code, exchanges it
 * for tokens, and persists them. Returns the obtained credentials.
 */
export async function runAuthFlow(
  scopes: string[],
  log: (msg: string) => void = (m) => process.stdout.write(m),
): Promise<Credentials> {
  const oauth = createOAuthClient();
  const { port, pathname } = redirectInfo();

  const consentUrl = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  log("\nGoogle authorization\n");
  log("Open this URL in your browser and grant access:\n\n");
  log(`  ${consentUrl}\n\n`);
  log(`Waiting for the redirect on port ${port}...\n`);

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
          "<html><body><h2>Authorized.</h2><p>You can close this tab and return to the terminal.</p></body></html>",
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
  log("\nTokens saved. Setup complete.\n");
  return tokens;
}
