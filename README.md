# interactive-edtech-mcp

> An MCP server suite that lets coding agents generate **deep instructional content** from external sources and **operate classroom-interactive EdTech platforms** — Padlet, Google Classroom, Kahoot!, Wayground (Quizizz), Wordwall, and Nearpod.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.x-blue.svg)](https://modelcontextprotocol.io)

Works with any MCP-capable agent: **Claude Code, Cursor, Codex, OpenCode, Antigravity**, and more.

---

## Why this exists

The native AI features in classroom-interactive tools tend to produce **shallow** content (clustered at the "remember/understand" Bloom levels, no rationales, no rubrics), are **hard to wire into agent workflows**, and **can't easily ingest your own materials**. This suite fixes that by splitting the problem in two:

1. **A platform-agnostic depth layer** — agents ingest your files/URLs/web research, align to 108課綱, and generate quizzes/lessons/boards that are *validated and depth-scored* (higher-order Bloom ratio, explanations, rubrics).
2. **A high-fidelity delivery layer** — each platform gets the best supported path: a real API where one exists, or an official import/export file where it doesn't.

### Platform support matrix

| Platform | Create path | Read path | Notes |
|----------|-------------|-----------|-------|
| **Padlet** | ✅ Official REST API (live board + posts) | ✅ board/posts | Full automation via `PADLET_API_KEY`. |
| **Google Classroom** | ✅ Official API (assignments, materials, announcements, topics, roster) | ✅ courses/submissions | OAuth2; the distribution hub for everything else. |
| **Kahoot!** | ⬇️ Official `.xlsx` import workbook | ✅ Reports API (results) | No creation API; Reports API needs EDU/enterprise. |
| **Wayground (Quizizz)** | ⬇️ Official spreadsheet import | — | No public read API. |
| **Wordwall** | ⬇️ Template-mapped content file | ✅ oEmbed | Content is pasted per-item (no bulk-import API). |
| **Nearpod** | ⬇️ Google Slides-compatible `.pptx` | — | Import via the Nearpod Google Slides add-on. |

⬇️ = produces a file you upload in one step. We deliberately **do not** use browser automation (brittle, ToS-risky).

---

## Tool catalog (32 tools)

**Content generation (platform-agnostic)**
- `content_ingest_source` — parse a file (.pdf/.docx/.txt/.md/.csv/.json) or URL into structured material
- `content_web_research` — Tavily web search → source material
- `content_align_curriculum` — 108課綱 alignment scaffold (core competencies + objectives)
- `content_generate_quiz` / `content_generate_lesson` / `content_generate_board` — two-step *brief → validate & depth-score*

**Padlet** — `padlet_get_board`, `padlet_list_posts`, `padlet_create_ai_board`, `padlet_add_post`, `padlet_seed_board`

**Google Classroom** — `classroom_list_courses`, `classroom_create_course`, `classroom_get_course`, `classroom_create_coursework`, `classroom_create_material`, `classroom_post_announcement`, `classroom_create_topic`, `classroom_list_students`, `classroom_add_student`, `classroom_list_teachers`, `classroom_list_submissions`, `classroom_get_submission`, `classroom_return_grade`

**Kahoot** — `kahoot_build_import_xlsx`, `kahoot_get_report`, `kahoot_analyze_results`

**Wayground** — `wayground_build_import_spreadsheet`

**Wordwall** — `wordwall_build_activity_content`, `wordwall_get_oembed`

**Nearpod** — `nearpod_build_slides_export`

**Workflow** — `workflow_generate_and_distribute` (produce the platform artifact, then optionally create a Google Classroom assignment for it)

---

## Installation

### Prerequisites
- Node.js ≥ 18
- [pnpm](https://pnpm.io) (`corepack enable pnpm`)

### Build from source

```bash
git clone https://github.com/FW1201/interactive-edtech-mcp.git
cd interactive-edtech-mcp
pnpm install
pnpm build
```

The server entry point is `apps/server/dist/index.js`. Verify it:

```bash
node apps/server/dist/index.js   # prints: ...running on stdio (32 tools)
```

### Environment variables

All keys are optional — tools whose credentials are missing simply return an actionable error; the rest keep working.

| Variable | Used by | How to get it |
|----------|---------|---------------|
| `PADLET_API_KEY` | Padlet tools | https://padlet.com/dashboard/settings/developers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Classroom | [Google Cloud Console](https://console.cloud.google.com) → OAuth client (Desktop) with the Classroom API enabled |
| `GOOGLE_REDIRECT_URI` | Google Classroom | optional, default `http://localhost:3000/oauth2callback` |
| `GOOGLE_TOKEN_PATH` | Google Classroom | optional, default `./.tokens/google-token.json` |
| `KAHOOT_API_KEY` | Kahoot Reports API | Kahoot EDU/enterprise plan |
| `TAVILY_API_KEY` (or `WEB_SEARCH_API_KEY`) | `content_web_research` | https://tavily.com |

Copy `.env.example` to `.env` for local runs.

---

## Connect your agent

Replace `/ABS/PATH` with the absolute path to your clone. The server speaks standard MCP over **stdio**, so any MCP client works.

### Claude Code

```bash
claude mcp add interactive-edtech -- node /ABS/PATH/interactive-edtech-mcp/apps/server/dist/index.js
```

Or add to `.mcp.json` (project) / `~/.claude.json` (global):

```json
{
  "mcpServers": {
    "interactive-edtech": {
      "command": "node",
      "args": ["/ABS/PATH/interactive-edtech-mcp/apps/server/dist/index.js"],
      "env": { "PADLET_API_KEY": "...", "TAVILY_API_KEY": "..." }
    }
  }
}
```

Then in a session: `> use content_generate_quiz to draft a deep 8-question quiz on 光合作用 for 國中一年級, then build a Kahoot import file`.

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "interactive-edtech": {
      "command": "node",
      "args": ["/ABS/PATH/interactive-edtech-mcp/apps/server/dist/index.js"],
      "env": { "PADLET_API_KEY": "..." }
    }
  }
}
```

Enable it under **Settings → MCP**, then ask the agent in Composer.

### Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.interactive-edtech]
command = "node"
args = ["/ABS/PATH/interactive-edtech-mcp/apps/server/dist/index.js"]

[mcp_servers.interactive-edtech.env]
PADLET_API_KEY = "..."
TAVILY_API_KEY = "..."
```

Run `codex` and the tools are available to the agent.

### OpenCode

`opencode.json` (project) or `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "interactive-edtech": {
      "type": "local",
      "command": ["node", "/ABS/PATH/interactive-edtech-mcp/apps/server/dist/index.js"],
      "environment": { "PADLET_API_KEY": "..." },
      "enabled": true
    }
  }
}
```

### Antigravity

In Antigravity, open **MCP settings** (Agent panel → Manage MCP servers → Edit config) and add:

```json
{
  "mcpServers": {
    "interactive-edtech": {
      "command": "node",
      "args": ["/ABS/PATH/interactive-edtech-mcp/apps/server/dist/index.js"],
      "env": { "PADLET_API_KEY": "..." }
    }
  }
}
```

Reload servers; the 32 tools appear to the Antigravity agent.

### Remote / HTTP mode (optional)

```bash
TRANSPORT=http PORT=3000 node apps/server/dist/index.js
# Streamable HTTP endpoint at http://127.0.0.1:3000/mcp ; health at /health
```

---

## Google Classroom OAuth (one-time)

```bash
# After setting GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET:
node packages/adapters/google-classroom/dist/auth-cli.js
```

It prints a consent URL, captures the redirect, and writes a token to `GOOGLE_TOKEN_PATH`. After that, the `classroom_*` and `workflow_*` Classroom features work.

---

## Usage examples

**1. Deep quiz → Kahoot**
> "Ingest `syllabus.pdf`, then generate a 10-question quiz on cell biology for 高中一年級 with rationales and rubrics, then build the Kahoot import workbook."
The agent calls `content_ingest_source` → `content_generate_quiz` (brief, then validate) → `kahoot_build_import_xlsx`, and tells you the `.xlsx` path to upload.

**2. Lesson → Nearpod**
> "Make an 8-slide interactive lesson on the water cycle with formative checks, then export it for Nearpod."
→ `content_generate_lesson` → `nearpod_build_slides_export` (`.pptx` to import via the Google Slides add-on).

**3. End-to-end → Google Classroom**
> "Generate a discussion board on AI ethics, publish it to Padlet, and assign it in Classroom course 12345."
→ `content_generate_board` → `workflow_generate_and_distribute` (Padlet board live URL → `classroom_create_coursework` link assignment).

---

## Limitations & Terms of Service

- **No browser automation.** For Kahoot/Wayground/Wordwall/Nearpod, "create" produces an official import/export file you upload in one manual step. This is a deliberate, ToS-safe choice.
- The MCP server has **no LLM of its own** — `content_generate_*` returns a *brief* for your agent to author from, then *validates and depth-scores* the draft. This keeps generation in your agent and enforcement in the server.
- Padlet's public API creates boards via the **AI-board** flow (no blank-board endpoint). Kahoot Reports API and Padlet API require paid plans.
- The 108課綱 alignment dataset is a representative **seed**, designed to be extended.

---

## Architecture

```
interactive-edtech-mcp/            pnpm monorepo
├── packages/
│   ├── core/                      content models (Zod), pedagogy (Bloom/depth), validation
│   ├── sources/                   file/URL/web ingestion, 108課綱 alignment
│   ├── mcp-shared/                ToolDefinition contract, formatting, errors, http, auth
│   └── adapters/
│       ├── padlet/                official REST API
│       ├── google-classroom/      official API + OAuth2 (googleapis)
│       ├── kahoot/                .xlsx import + Reports API
│       ├── wayground/             spreadsheet import
│       ├── wordwall/              template content + oEmbed
│       └── nearpod/               Google Slides-compatible .pptx
└── apps/server/                   single MCP server (registers all tools) + workflow
```

Each adapter exports a `ToolDefinition[]` plus reusable functions; the server collects them and adds the content-generation and workflow tools.

## Development

```bash
pnpm build        # build all packages (topological order)
pnpm test         # run all unit tests (44 tests)
pnpm typecheck    # type-check without emit
pnpm inspector    # launch the MCP Inspector against the server
```

Evaluations: [`evals/evaluation.xml`](evals/evaluation.xml) (deterministic, offline).

## License

[MIT](LICENSE) © Kevin Wu (FW1201)
