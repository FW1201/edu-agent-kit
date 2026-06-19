/**
 * Padlet MCP tools.
 *
 * Implements only operations the official Padlet API actually supports
 * (see client.ts header for the confirmed endpoint list). Notable gap:
 * there is NO "create blank board" endpoint — boards can only be created via
 * the asynchronous AI-recipe-board flow. This shapes `padlet_create_ai_board`
 * and `padlet_seed_board` below.
 */

import { z } from "zod";
import {
  Board,
  BoardPost,
  ResponseFormat,
  ResponseFormatSchema,
} from "@interactive-edtech/core";
import {
  defineTool,
  type ToolDefinition,
  dualResult,
  errorResult,
  handleApiError,
  paginate,
  objectToMarkdown,
} from "@interactive-edtech/mcp-shared";
import {
  getBoard,
  listPosts,
  addPost,
  createAiBoardAndWait,
  type PadletBoardResource,
  type PadletPostResource,
  type PadletSectionResource,
} from "./client.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const BOARD_ID = z
  .string()
  .min(16)
  .max(22)
  .describe("Padlet board id (16-22 chars), e.g. 'abcd1234efgh5678'.");

/** Flatten a Padlet board resource into a plain structured object. */
function boardToStructured(
  board: PadletBoardResource,
  sections: PadletSectionResource[],
  postCount: number,
): Record<string, unknown> {
  return {
    id: board.id,
    title: board.attributes.title ?? "",
    description: board.attributes.description ?? "",
    url: board.attributes.webUrl?.live ?? "",
    sections: sections.map((s) => ({ id: s.id, title: s.attributes.title ?? "" })),
    postCount,
    createdAt: board.attributes.createdAt,
    updatedAt: board.attributes.updatedAt,
  };
}

/** Flatten a Padlet post resource into a plain structured object. */
function postToStructured(post: PadletPostResource): Record<string, unknown> {
  const content = post.attributes.content ?? {};
  return {
    id: post.id,
    subject: content.subject ?? "",
    body: content.body ?? "",
    color: post.attributes.color ?? null,
    sectionId: post.relationships?.section?.data?.id ?? null,
    attachmentUrl: content.attachment?.url ?? null,
    url: post.attributes.webUrl?.live ?? null,
  };
}

// ---------------------------------------------------------------------------
// padlet_get_board
// ---------------------------------------------------------------------------

const GetBoardInput = z
  .object({ board_id: BOARD_ID })
  .strict();

export const getBoardTool = defineTool({
  name: "padlet_get_board",
  title: "Get a Padlet board",
  description: [
    "Fetch a Padlet board's metadata, sections and post count.",
    "Args: board_id (16-22 char board id; you must be admin/owner of the board).",
    "Returns (structured): { id, title, description, url, sections:[{id,title}], postCount, createdAt, updatedAt }.",
    "Example: padlet_get_board({ board_id: 'abcd1234efgh5678' }).",
    "Errors: 404 if the id is wrong or you lack access; 401 if PADLET_API_KEY is missing/invalid.",
  ].join("\n"),
  inputSchema: GetBoardInput,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (args) => {
    try {
      const res = await getBoard(args.board_id);
      const included = res.included ?? [];
      const sections = included.filter(
        (e): e is PadletSectionResource => e.type === "section",
      );
      const postCount = included.filter((e) => e.type === "post").length;
      const structured = boardToStructured(res.data, sections, postCount);
      const md = objectToMarkdown(structured, "Padlet board");
      return dualResult(md, structured);
    } catch (err) {
      return errorResult(handleApiError(err, "Padlet"));
    }
  },
});

// ---------------------------------------------------------------------------
// padlet_list_posts
// ---------------------------------------------------------------------------

const ListPostsInput = z
  .object({
    board_id: BOARD_ID,
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe("Max posts to return (1-200)."),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Number of posts to skip (for pagination)."),
    response_format: ResponseFormatSchema,
  })
  .strict();

export const listPostsTool = defineTool({
  name: "padlet_list_posts",
  title: "List posts on a Padlet board",
  description: [
    "List the posts on a Padlet board, paginated.",
    "Args: board_id, limit (1-200, default 50), offset (default 0), response_format ('markdown'|'json', default markdown).",
    "Returns (structured): a paginated envelope { total, count, offset, has_more, next_offset?, items:[{id,subject,body,color,sectionId,attachmentUrl,url}] }.",
    "Note: Padlet has no standalone posts endpoint; posts are read from the board, so pagination is applied client-side.",
    "Example: padlet_list_posts({ board_id: 'abcd1234efgh5678', limit: 20 }).",
    "Errors: 404 unknown/forbidden board; 401 missing PADLET_API_KEY.",
  ].join("\n"),
  inputSchema: ListPostsInput,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  handler: async (args) => {
    try {
      const posts = await listPosts(args.board_id);
      const structuredPosts = posts.map(postToStructured);
      const page = paginate(structuredPosts, {
        limit: args.limit,
        offset: args.offset,
      });
      const md =
        args.response_format === ResponseFormat.JSON
          ? "```json\n" + JSON.stringify(page, null, 2) + "\n```"
          : renderPostsMarkdown(page.items, page);
      return dualResult(md, page);
    } catch (err) {
      return errorResult(handleApiError(err, "Padlet"));
    }
  },
});

/** Render a markdown summary of a posts page. */
function renderPostsMarkdown(
  items: Array<Record<string, unknown>>,
  page: { total: number; count: number; offset: number; has_more: boolean },
): string {
  const lines: string[] = [
    `## Padlet posts (${page.count} of ${page.total}, offset ${page.offset})`,
  ];
  for (const p of items) {
    const subject = String(p.subject ?? "").trim();
    const body = String(p.body ?? "").trim();
    const head = subject || body.slice(0, 60) || "(empty)";
    lines.push(`- **${head}** — id \`${String(p.id)}\``);
  }
  if (page.has_more) lines.push("\n_More posts available — increase offset._");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// padlet_create_ai_board
// ---------------------------------------------------------------------------

const CreateAiBoardInput = z
  .object({
    prompt: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        "Natural-language board creation instructions (max 2000 chars), e.g. 'Create a brainstorming wall for 7th grade ecosystems'.",
      ),
    role: z
      .string()
      .min(1)
      .default("teacher")
      .describe("Requester role required by the API, e.g. 'teacher' or 'student'."),
    workspace_id: z
      .string()
      .optional()
      .describe("Optional workspace id to create the board in."),
  })
  .strict();

export const createAiBoardTool = defineTool({
  name: "padlet_create_ai_board",
  title: "Create a Padlet board from a prompt (AI recipe board)",
  description: [
    "Create a new Padlet board from a natural-language prompt using Padlet's AI recipe-board generator.",
    "This is the ONLY board-creation path the public API offers (there is no blank-board endpoint).",
    "Creation is asynchronous; this tool starts it and polls until the board is ready (typically 30s-3min).",
    "Args: prompt (<=2000 chars), role (default 'teacher'), workspace_id (optional).",
    "Returns (structured): { boardId, title, url }.",
    "Example: padlet_create_ai_board({ prompt: 'KWL chart board on the water cycle for grade 5', role: 'teacher' }).",
    "Errors: 401 missing key; 403 plan/permission; timeout if generation exceeds ~2min (retry with the returned status).",
  ].join("\n"),
  inputSchema: CreateAiBoardInput,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: async (args) => {
    try {
      const board = await createAiBoardAndWait({
        prompt: args.prompt,
        role: args.role,
        workspaceId: args.workspace_id,
      });
      const structured: Record<string, unknown> = {
        boardId: board.boardId,
        title: board.title ?? "",
        url: board.url ?? "",
      };
      const md = objectToMarkdown(structured, "Created Padlet AI board");
      return dualResult(md, structured);
    } catch (err) {
      return errorResult(handleApiError(err, "Padlet"));
    }
  },
});

// ---------------------------------------------------------------------------
// padlet_add_post
// ---------------------------------------------------------------------------

const AddPostInput = z
  .object({
    board_id: BOARD_ID,
    post: BoardPost.describe("A core BoardPost: { subject?, body, media?, section?, color? }."),
  })
  .strict();

export const addPostTool = defineTool({
  name: "padlet_add_post",
  title: "Add a post to a Padlet board",
  description: [
    "Add a single post (card) to an existing Padlet board.",
    "Args: board_id, post — a core BoardPost { subject?, body (required, may be ''), media? {kind,url,title?,altText?}, section? (section id), color? (red|orange|green|blue|purple) }.",
    "Mapping: media.url -> attachment.url, media.title/altText -> attachment.caption, section -> JSON:API section relationship.",
    "Returns (structured): { id, subject, body, color, sectionId, attachmentUrl, url }.",
    "Example: padlet_add_post({ board_id: 'abcd1234efgh5678', post: { subject: 'Photosynthesis', body: 'Define it.', color: 'green' } }).",
    "Errors: 404 unknown board; 401 missing key; 422 if content is empty (provide subject, body, or media).",
  ].join("\n"),
  inputSchema: AddPostInput,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: async (args) => {
    try {
      const res = await addPost(args.board_id, args.post);
      const structured = postToStructured(res.data);
      const md = objectToMarkdown(structured, "Added Padlet post");
      return dualResult(md, structured);
    } catch (err) {
      return errorResult(handleApiError(err, "Padlet"));
    }
  },
});

// ---------------------------------------------------------------------------
// padlet_seed_board (workflow helper)
// ---------------------------------------------------------------------------

const SeedBoardInput = z
  .object({
    board: Board.describe(
      "A core Board object. Its seedPosts are the cards to add. title/description are used as the AI prompt when ai_prompt is omitted.",
    ),
    board_id: BOARD_ID.optional().describe(
      "Existing board id to seed. Provide this OR ai_prompt (or rely on the board title/description to auto-generate the prompt).",
    ),
    ai_prompt: z
      .string()
      .min(1)
      .max(2000)
      .optional()
      .describe(
        "If no board_id, create a new AI recipe board from this prompt first, then seed it.",
      ),
    role: z
      .string()
      .min(1)
      .default("teacher")
      .describe("Role used when creating an AI board (ignored if board_id is given)."),
  })
  .strict();

export const seedBoardTool = defineTool({
  name: "padlet_seed_board",
  title: "Seed a Padlet board with starter posts",
  description: [
    "Workflow helper: locate (existing board_id) OR create (AI prompt) a board, then add every seedPost from the core Board.",
    "Args: board (core Board with seedPosts), and EITHER board_id (seed an existing board) OR ai_prompt (create then seed).",
    "If neither board_id nor ai_prompt is given, an AI board is generated from the board's title/description.",
    "role defaults to 'teacher' (only used when creating a board).",
    "Returns (structured): { boardId, url, requested, added, failed, errors:[...] }.",
    "Example: padlet_seed_board({ board: {title:'Ecosystems', seedPosts:[{body:'What is a food web?'}]}, ai_prompt:'Discussion wall on ecosystems' }).",
    "Limitation: the API cannot create a blank board, so a prompt (explicit or derived from title/description) is required when board_id is absent.",
    "Errors: bubbles up create/add errors per service; partial success is reported via added/failed.",
  ].join("\n"),
  inputSchema: SeedBoardInput,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  handler: async (args) => {
    try {
      let boardId = args.board_id;
      let url: string | undefined;

      if (!boardId) {
        const prompt =
          args.ai_prompt ??
          [args.board.title, args.board.description]
            .filter((s): s is string => Boolean(s))
            .join(". ");
        if (!prompt.trim()) {
          return errorResult(
            "[Padlet] Error: no board_id given and no prompt available. Provide board_id, ai_prompt, or a board title/description.",
          );
        }
        const created = await createAiBoardAndWait({
          prompt: prompt.slice(0, 2000),
          role: args.role,
        });
        boardId = created.boardId;
        url = created.url;
      }

      const seedPosts = args.board.seedPosts;
      let added = 0;
      const errors: string[] = [];
      for (const post of seedPosts) {
        try {
          await addPost(boardId, post);
          added += 1;
        } catch (err) {
          errors.push(handleApiError(err, "Padlet"));
        }
      }

      // If we seeded an existing board, fetch its URL for the report.
      if (!url) {
        try {
          const board = await getBoard(boardId);
          url = board.data.attributes.webUrl?.live;
        } catch {
          /* non-fatal: URL is best-effort */
        }
      }

      const structured: Record<string, unknown> = {
        boardId,
        url: url ?? "",
        requested: seedPosts.length,
        added,
        failed: seedPosts.length - added,
        errors,
      };
      const md = objectToMarkdown(structured, "Seeded Padlet board");
      return dualResult(md, structured);
    } catch (err) {
      return errorResult(handleApiError(err, "Padlet"));
    }
  },
});

/** All Padlet tools, in registration order. */
export const padletToolList: ToolDefinition[] = [
  getBoardTool,
  listPostsTool,
  createAiBoardTool,
  addPostTool,
  seedBoardTool,
] as unknown as ToolDefinition[];
