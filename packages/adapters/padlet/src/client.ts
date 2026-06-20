/**
 * Thin Padlet REST API client built on the shared httpRequest helper.
 *
 * Padlet API facts confirmed from https://docs.padlet.dev (reference *.md pages):
 *  - Base URL:        https://api.padlet.dev/v1
 *  - Auth header:     X-API-KEY (obtain at https://padlet.com/dashboard/settings/developers)
 *  - Style:           JSON:API. Create endpoints expect/return `{ data: { type, attributes, relationships } }`.
 *  - Content type:    application/vnd.api+json for write requests.
 *
 * Endpoints used here:
 *  - GET  /boards/{id}?include=posts,sections,comments   → fetch a board + its posts/sections (JSON:API `included`).
 *  - POST /boards/{id}/posts                              → add a single post.
 *  - POST /ai-recipe-boards                               → create a board from a natural-language prompt (ASYNC).
 *  - GET  /ai-recipe-boards/status/{key}                  → poll AI-board creation status until success/failed.
 *
 * KNOWN API LIMITATION (documented per spec): the public API exposes NO endpoint to
 * create a blank/empty board. The only board-creation path is the asynchronous
 * `POST /ai-recipe-boards` (an AI "recipe" board generated from a prompt). Therefore
 * `seed_board` requires either an existing boardId or an AI-board prompt — it cannot
 * conjure a blank board.
 */

import { httpRequest, resolveCredential, MissingCredentialError } from "@edu-agent-kit/mcp-shared";
import type { BoardPost } from "@edu-agent-kit/core";

/** Base URL for the Padlet API (v1). */
export const PADLET_BASE_URL = "https://api.padlet.dev/v1";

/** JSON:API content type required by Padlet write endpoints. */
const JSON_API_CONTENT_TYPE = "application/vnd.api+json";

/** Read the API key (env PADLET_API_KEY → credential store). Throws if missing. */
async function apiKey(): Promise<string> {
  const key = await resolveCredential("PADLET_API_KEY", "padlet", "apiKey");
  if (!key) {
    throw new MissingCredentialError(
      "PADLET_API_KEY",
      "Run `edu-agent-kit auth login padlet`, or set PADLET_API_KEY. Key page: https://padlet.com/dashboard/settings/developers",
    );
  }
  return key;
}

/** Standard headers for every request (the X-API-KEY is centralized here). */
async function headers(write = false): Promise<Record<string, string>> {
  const h: Record<string, string> = { "X-API-KEY": await apiKey() };
  if (write) h["Content-Type"] = JSON_API_CONTENT_TYPE;
  return h;
}

// ---------------------------------------------------------------------------
// JSON:API response shapes (only the fields this adapter consumes are typed).
// ---------------------------------------------------------------------------

/** A JSON:API resource linkage `{ id, type }`. */
export interface ResourceLinkage {
  id: string;
  type: string;
}

/** Padlet post attachment object (subset). */
export interface PadletAttachment {
  url?: string;
  caption?: string;
  previewImageUrl?: string;
  embedCode?: string;
  poll?: { question: string; choices: string[] };
}

/** Padlet post content object (subset). */
export interface PadletPostContent {
  subject?: string;
  body?: string;
  attachment?: PadletAttachment;
}

/** A JSON:API `post` resource as returned by Padlet (subset of attributes). */
export interface PadletPostResource {
  id: string;
  type: "post";
  attributes: {
    content?: PadletPostContent;
    color?: string;
    status?: string;
    webUrl?: { live?: string };
    createdAt?: string;
    updatedAt?: string;
  };
  relationships?: {
    section?: { data?: ResourceLinkage | null };
  };
}

/** A JSON:API `section` resource (subset). */
export interface PadletSectionResource {
  id: string;
  type: "section";
  attributes: { title?: string };
}

/** A JSON:API `board` resource (subset). */
export interface PadletBoardResource {
  id: string;
  type: "board";
  attributes: {
    title?: string;
    description?: string;
    iconUrl?: string;
    webUrl?: { live?: string; qrCode?: string; slideshow?: string };
    createdAt?: string;
    updatedAt?: string;
  };
  relationships?: {
    sections?: { data?: ResourceLinkage[] };
    posts?: { data?: ResourceLinkage[] };
    comments?: { data?: ResourceLinkage[] };
  };
}

/** Full `GET /boards/{id}` response. */
export interface GetBoardResponse {
  data: PadletBoardResource;
  included?: Array<
    PadletPostResource | PadletSectionResource | { id: string; type: string }
  >;
}

/** `POST /boards/{id}/posts` response. */
export interface AddPostResponse {
  data: PadletPostResource;
}

/** `POST /ai-recipe-boards` response (async — gives a status URL to poll). */
export interface CreateAiBoardResponse {
  data: {
    id: string;
    type: string;
    attributes: { statusUrl: string };
  };
}

/** `GET /ai-recipe-boards/status/{key}` response. */
export interface AiBoardStatusResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      status: "in_progress" | "success" | "failed";
      board?: {
        id: string;
        type: "board";
        attributes: { title?: string; webUrl?: { live?: string } };
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Pure mapping: core BoardPost → Padlet JSON:API post body (unit-testable).
// ---------------------------------------------------------------------------

/** The JSON:API post body shape sent to `POST /boards/{id}/posts`. */
export interface PadletPostBody {
  data: {
    type: "post";
    attributes: {
      content: PadletPostContent;
      color?: BoardPost["color"];
    };
    relationships?: {
      section?: { data: { id: string; type: "section" } };
    };
  };
}

/**
 * Map a core `BoardPost` to the Padlet JSON:API post request body.
 *
 * Mapping rules:
 *  - subject → content.subject (omitted when absent)
 *  - body    → content.body
 *  - media   → content.attachment.url (+ caption from media.title/altText)
 *  - color   → attributes.color (core colors are a subset of Padlet's palette)
 *  - section → relationships.section.data.id (treated as a Padlet section id)
 *
 * NOTE: the core `MediaRef.kind` (image/video/link/youtube/...) has no direct
 * Padlet field — Padlet auto-detects the attachment type from the URL — so kind
 * is intentionally not forwarded. This function performs NO network I/O.
 */
export function buildPostPayload(post: BoardPost): PadletPostBody {
  const content: PadletPostContent = { body: post.body };
  if (post.subject !== undefined) content.subject = post.subject;
  if (post.media !== undefined) {
    const caption = post.media.title ?? post.media.altText;
    content.attachment = {
      url: post.media.url,
      ...(caption !== undefined ? { caption } : {}),
    };
  }

  const body: PadletPostBody = {
    data: {
      type: "post",
      attributes: { content },
    },
  };
  if (post.color !== undefined) body.data.attributes.color = post.color;
  if (post.section !== undefined) {
    body.data.relationships = {
      section: { data: { id: post.section, type: "section" } },
    };
  }
  return body;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** Pagination options for {@link listPosts}. */
export interface ListOptions {
  limit: number;
  offset: number;
}

/** Fetch a board (with posts, sections and comments included). */
export async function getBoard(boardId: string): Promise<GetBoardResponse> {
  return httpRequest<GetBoardResponse>(`${PADLET_BASE_URL}/boards/${boardId}`, {
    method: "GET",
    headers: await headers(),
    query: { include: "posts,sections,comments" },
  });
}

/**
 * Type guard: is an `included` entry a post resource?
 * (The API has no posts list endpoint; posts arrive via the board's `included`.)
 */
function isPostResource(
  entry: { id: string; type: string },
): entry is PadletPostResource {
  return entry.type === "post";
}

/**
 * Extract all posts for a board. Padlet has no standalone paginated posts
 * endpoint, so posts are read from the board's JSON:API `included` array.
 * Pagination is applied locally by the tool layer via `paginate`.
 */
export async function listPosts(
  boardId: string,
  _opts?: ListOptions,
): Promise<PadletPostResource[]> {
  void _opts; // pagination handled by the caller via the shared `paginate` helper
  const board = await getBoard(boardId);
  return (board.included ?? []).filter(isPostResource);
}

/** Parameters for creating an AI recipe board. */
export interface CreateAiBoardParams {
  /** Natural-language board creation instructions (max 2000 chars). */
  prompt: string;
  /** Required by the API: the requester's role, e.g. "teacher" or "student". */
  role: string;
  /** Optional workspace to create the board in. */
  workspaceId?: string;
}

/**
 * Kick off asynchronous AI recipe board creation. Returns the status URL to
 * poll. Use {@link pollAiBoardStatus} (or {@link createAiBoardAndWait}) to wait
 * for completion.
 */
export async function createAiBoard(
  params: CreateAiBoardParams,
): Promise<CreateAiBoardResponse> {
  return httpRequest<CreateAiBoardResponse>(
    `${PADLET_BASE_URL}/ai-recipe-boards`,
    {
      method: "POST",
      headers: await headers(true),
      json: {
        data: {
          type: "ai_recipe_board",
          attributes: {
            boardCreationInstructions: params.prompt,
            role: params.role,
            ...(params.workspaceId !== undefined
              ? { workspaceId: params.workspaceId }
              : {}),
          },
        },
      },
    },
  );
}

/**
 * Poll an AI-board status URL once. The URL is the absolute `statusUrl` returned
 * by {@link createAiBoard}; it is requested as-is (already includes the host).
 */
export async function pollAiBoardStatus(
  statusUrl: string,
): Promise<AiBoardStatusResponse> {
  return httpRequest<AiBoardStatusResponse>(statusUrl, {
    method: "GET",
    headers: await headers(),
  });
}

/** A short async sleep used between status polls. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Result of a completed AI-board creation. */
export interface CreatedAiBoard {
  boardId: string;
  title?: string;
  url?: string;
}

/**
 * Create an AI recipe board and poll until it is ready (or fails / times out).
 * Polls every `intervalMs` (default 3s) up to `maxAttempts` (default 40 ≈ 2 min),
 * matching Padlet's "30s–3min" guidance.
 */
export async function createAiBoardAndWait(
  params: CreateAiBoardParams,
  options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<CreatedAiBoard> {
  const intervalMs = options.intervalMs ?? 3000;
  const maxAttempts = options.maxAttempts ?? 40;

  const created = await createAiBoard(params);
  const statusUrl = created.data.attributes.statusUrl;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await pollAiBoardStatus(statusUrl);
    const attrs = status.data.attributes;
    if (attrs.status === "success" && attrs.board) {
      return {
        boardId: attrs.board.id,
        title: attrs.board.attributes.title,
        url: attrs.board.attributes.webUrl?.live,
      };
    }
    if (attrs.status === "failed") {
      throw new Error("Padlet AI board creation failed.");
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Padlet AI board creation did not complete within ${
      (intervalMs * maxAttempts) / 1000
    }s. Status URL: ${statusUrl}`,
  );
}

/** Add a single post to a board, mapping the core BoardPost via buildPostPayload. */
export async function addPost(
  boardId: string,
  post: BoardPost,
): Promise<AddPostResponse> {
  return httpRequest<AddPostResponse>(
    `${PADLET_BASE_URL}/boards/${boardId}/posts`,
    {
      method: "POST",
      headers: await headers(true),
      json: buildPostPayload(post),
    },
  );
}
