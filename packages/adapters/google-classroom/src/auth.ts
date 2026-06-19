/**
 * Classroom-specific auth, layered on @edu-agent-kit/google-shared.
 * SCOPES is the classroom slice of the shared scope registry; getClassroom
 * returns the authenticated Classroom API surface.
 */
import { google, type classroom_v1 } from "googleapis";
import {
  getAuthorizedClient,
  createOAuthClient,
  getTokenStore,
  tokenStorePath,
  scopesFor,
} from "@edu-agent-kit/google-shared";

/** OAuth scopes for the Classroom adapter (from the shared registry). */
export const SCOPES: string[] = scopesFor("classroom");

/** Build an authenticated Classroom API client (throws if not authorized). */
export async function getClassroom(): Promise<classroom_v1.Classroom> {
  const auth = await getAuthorizedClient();
  return google.classroom({ version: "v1", auth });
}

// Re-export shared helpers used elsewhere / by tests.
export { createOAuthClient, getTokenStore, tokenStorePath };
