/**
 * @edu-agent-kit/padlet
 *
 * Padlet adapter — official REST API (https://api.padlet.dev/v1).
 * Exposes MCP tools plus reusable client functions.
 *
 * API capability note: Padlet's public API can only CREATE boards via the
 * asynchronous AI-recipe-board flow (no blank-board endpoint). Reads, post
 * creation, and AI-board creation are fully supported.
 */

import type { ToolDefinition } from "@edu-agent-kit/mcp-shared";
import { padletToolList } from "./tools.js";

/** The full set of Padlet MCP tools for the server to register. */
export const padletTools: ToolDefinition[] = padletToolList;

// Re-export reusable client functions and the pure mapping helper.
export {
  getBoard,
  addPost,
  createAiBoard,
  createAiBoardAndWait,
  pollAiBoardStatus,
  buildPostPayload,
  listPosts,
  PADLET_BASE_URL,
} from "./client.js";

export type {
  CreateAiBoardParams,
  CreatedAiBoard,
  PadletPostBody,
  ListOptions,
  GetBoardResponse,
  AddPostResponse,
  CreateAiBoardResponse,
  AiBoardStatusResponse,
  PadletBoardResource,
  PadletPostResource,
  PadletSectionResource,
} from "./client.js";

// Re-export individual tools for selective registration / testing.
export {
  getBoardTool,
  listPostsTool,
  createAiBoardTool,
  addPostTool,
  seedBoardTool,
} from "./tools.js";
