import { z } from "zod";
import os from "node:os";
import path from "node:path";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  optionalEnv,
  MissingCredentialError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import { prepareHostingSite, deployHosting } from "./hosting.js";

const DeployInput = z
  .object({
    html: z.string().optional().describe("Inline HTML to publish as index.html."),
    sourceDir: z.string().optional().describe("Local directory to publish as-is."),
    projectId: z
      .string()
      .optional()
      .describe("Firebase project id. Defaults to FIREBASE_PROJECT env."),
  })
  .strict();

export const deployHostingTool = defineTool({
  name: "firebase_deploy_hosting",
  title: "Deploy to Firebase Hosting",
  description: `Publish interactive teaching material to Firebase Hosting and return the live URL.

Provide exactly one content source:
  - html (string): inline HTML published as index.html, or
  - sourceDir (string): a local folder published as-is.
Args also: projectId? (defaults to FIREBASE_PROJECT env).

Requires FIREBASE_TOKEN (from \`firebase login:ci\`) and a Firebase project. Deploys via firebase-tools (run through npx).

Returns (structuredContent): { url }.

Error handling: returns a credential error if FIREBASE_TOKEN or the project id is missing.`,
  inputSchema: DeployInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    const projectId = args.projectId ?? optionalEnv("FIREBASE_PROJECT");
    const token = optionalEnv("FIREBASE_TOKEN");
    if (!projectId) {
      return errorResult(
        "Missing Firebase project id: pass projectId or set FIREBASE_PROJECT.",
      );
    }
    if (!token) {
      return errorResult(
        new MissingCredentialError(
          "FIREBASE_TOKEN",
          "Get a token with `firebase login:ci` (install: npm i -g firebase-tools).",
        ).message,
      );
    }
    if (!args.html && !args.sourceDir) {
      return errorResult("Provide either 'html' or 'sourceDir'.");
    }
    try {
      const siteDir = path.join(os.tmpdir(), `eak-firebase-${Date.now()}`);
      await prepareHostingSite({ html: args.html, sourceDir: args.sourceDir, siteDir, projectId });
      const res = await deployHosting({ siteDir, projectId, token });
      return dualResult(`# Deployed to Firebase Hosting\n\n${res.url}`, { url: res.url });
    } catch (err) {
      return errorResult(handleApiError(err, "Firebase"));
    }
  },
});

export const firebaseToolList: ToolDefinition[] = [
  deployHostingTool,
] as unknown as ToolDefinition[];
