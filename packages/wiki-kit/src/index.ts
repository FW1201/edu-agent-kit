/**
 * @edu-agent-kit/wiki-kit
 *
 * LLM-wiki scaffolder for educators: templates + folder tree + WIKI.md schema +
 * cross-agent memory/core files + dispatch commands, wired to edu-agent-kit MCP.
 */
export { scaffoldWiki } from "./scaffold.js";
export { TEMPLATES, listTemplates, getTemplate } from "./templates.js";
export { DISPATCH } from "./content.js";
export {
  ALL_AGENTS,
  type AgentId,
  type WikiProfile,
  type WikiTemplate,
  type ScaffoldOptions,
  type ScaffoldResult,
} from "./types.js";
