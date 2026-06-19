/**
 * OAuth2 + client construction for the Google Classroom adapter.
 *
 * Credentials come from env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET); the
 * refresh/access token is persisted by a JsonTokenStore and is created by the
 * one-time consent flow in `auth-cli.ts`.
 */
import { google, type classroom_v1, type Auth } from "googleapis";
import { JsonTokenStore, optionalEnv, requireEnv, MissingCredentialError } from "@interactive-edtech/mcp-shared";

/** OAuth2 client type, sourced from googleapis' re-exported google-auth-library. */
type OAuth2Client = Auth.OAuth2Client;
/** Google OAuth credentials type. */
type Credentials = Auth.Credentials;

/**
 * OAuth scopes required by every tool in this adapter. Full URLs as required by
 * the Google consent screen.
 */
export const SCOPES: string[] = [
  "https://www.googleapis.com/auth/classroom.courses",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials",
  "https://www.googleapis.com/auth/classroom.announcements",
  "https://www.googleapis.com/auth/classroom.rosters",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readwrite",
  "https://www.googleapis.com/auth/classroom.topics",
];

/** Default redirect URI used by both the OAuth client and the auth CLI server. */
export const DEFAULT_REDIRECT_URI = "http://localhost:3000/oauth2callback";

/** Resolve the token-store path from env (or a sensible default). */
export function tokenStorePath(): string {
  return optionalEnv("GOOGLE_TOKEN_PATH") ?? `${process.cwd()}/.tokens/google-token.json`;
}

/** A JsonTokenStore typed for Google OAuth credentials. */
export function getTokenStore(): JsonTokenStore<Credentials> {
  return new JsonTokenStore<Credentials>(tokenStorePath());
}

/** Construct an OAuth2 client configured purely from env (no token loaded). */
export function createOAuthClient(): OAuth2Client {
  const clientId = requireEnv("GOOGLE_CLIENT_ID", "Create an OAuth client in Google Cloud Console (Classroom API enabled).");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET", "Copy the client secret from the same OAuth client.");
  const redirectUri = optionalEnv("GOOGLE_REDIRECT_URI") ?? DEFAULT_REDIRECT_URI;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Build an authenticated Classroom API client. Loads the persisted token,
 * applies it to a fresh OAuth client, and returns the `classroom` API surface.
 * Throws MissingCredentialError when no token has been stored yet.
 */
export async function getClassroom(): Promise<classroom_v1.Classroom> {
  const auth = createOAuthClient();
  const store = getTokenStore();
  const token = await store.read();
  if (!token || (!token.access_token && !token.refresh_token)) {
    throw new MissingCredentialError(
      "GOOGLE_TOKEN",
      "Run the auth CLI: node packages/adapters/google-classroom/dist/auth-cli.js",
    );
  }
  auth.setCredentials(token);
  // Persist refreshed tokens back to the store so the refresh token survives.
  auth.on("tokens", (refreshed: Credentials) => {
    void (async () => {
      try {
        const merged: Credentials = { ...token, ...refreshed };
        await store.write(merged);
      } catch {
        // Best-effort persistence; a failed write must not break the API call.
      }
    })();
  });
  return google.classroom({ version: "v1", auth });
}
