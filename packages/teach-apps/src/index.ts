/**
 * @edu-agent-kit/teach-apps
 *
 * Build self-contained interactive teaching activities (quiz, flashcards) from
 * generated content and deploy them (Vercel / GitHub Pages; Firebase via the
 * firebase adapter). Pillar 3 — teaching program development & deployment.
 */
import type { ToolDefinition } from "@edu-agent-kit/mcp-shared";
import { teachAppsToolList } from "./tools.js";

export const teachAppsTools: ToolDefinition[] = teachAppsToolList;

export { buildTeachApp, type BuildOptions, type BuildResult } from "./build.js";
export { deploySite, deployVercel, deployGithubPages, type DeployTarget } from "./deploy.js";
export { quizHtml, flashcardsHtml, TEMPLATES, type TeachAppTemplate, type FlashCard } from "./templates.js";
export { teachappBuildTool, teachappDeployTool } from "./tools.js";
