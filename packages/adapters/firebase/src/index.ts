/**
 * @edu-agent-kit/firebase
 *
 * Publish interactive teaching materials to Firebase Hosting. Deploy runs
 * firebase-tools via npx; requires FIREBASE_TOKEN + a Firebase project.
 */
import type { ToolDefinition } from "@edu-agent-kit/mcp-shared";
import { firebaseToolList } from "./tools.js";

export const firebaseTools: ToolDefinition[] = firebaseToolList;

export { buildFirebaseJson, prepareHostingSite, deployHosting } from "./hosting.js";
export { deployHostingTool } from "./tools.js";
