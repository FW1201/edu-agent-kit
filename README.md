# edu-agent-kit

> An agent-powered knowledge base & content toolkit for educators. Build a local **LLM-wiki** for your teaching materials, generate **deep instructional content** from your own sources, and export/distribute it to **Kahoot, Padlet, Nearpod, Wordwall, Wayground, Google Workspace, Google Classroom, and Firebase** — from any MCP-capable agent.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.x-blue.svg)](https://modelcontextprotocol.io)

**🇹🇼 繁體中文說明：[README.zh-TW.md](README.zh-TW.md)** ｜ 詳細安裝：[docs/INSTALL.md](docs/INSTALL.md) ｜ API 申請：[docs/API-SETUP.md](docs/API-SETUP.md)

Works with **Claude Code, Cursor, Codex, OpenCode, Antigravity**, and any MCP client.

---

## What it does

Native AI features in classroom tools produce shallow content, don't connect to agent workflows, and can't ingest your own materials. edu-agent-kit solves this end to end:

1. **Local LLM-wiki** — scaffold a knowledge base for your teaching materials (templated folders, agent memory/`CLAUDE.md`, dispatch commands), so an agent can orchestrate "material → knowledge base → generation → output."
2. **Deep content generation** — ingest files/URLs/images, align to Taiwan's 108課綱, and generate quizzes/lessons/boards that are *validated and Bloom-depth-scored*.
3. **High-fidelity delivery** — each platform gets its best supported path (official API where one exists, official import/export file otherwise) plus full Google Workspace + Classroom + Firebase output.

### Four surfaces (cross-agent)

| Surface | What | For |
|---------|------|-----|
| **MCP server** | 51 tools | the universal layer — every agent |
| **CLI** (`edu-agent-kit`) | scaffold wiki, Google auth, exports, doctor | any terminal/agent |
| **Skills** | 5 educator workflows (繁中) | Claude & skill-capable agents |
| **Claude Code Plugin** | one-click bundle (MCP + skills) | the Claude ecosystem |

### Platform support

| Platform | Create | Read |
|----------|--------|------|
| **Padlet** | ✅ official API (board + posts) | ✅ |
| **Google Classroom** | ✅ official API (assignments, materials, roster, grading) | ✅ |
| **Google Docs / Slides / Forms / Sheets** | ✅ official API | — |
| **Google Drive** | ✅ folders, upload, sharing | — |
| **Firebase Hosting** | ✅ publish material as a web page | — |
| **Kahoot!** | ⬇️ official `.xlsx` import | ✅ Reports API |
| **Wayground (Quizizz)** | ⬇️ official spreadsheet import | — |
| **Wordwall** | ⬇️ template content file | ✅ oEmbed |
| **Nearpod** | ⬇️ Google Slides `.pptx` | — |

⬇️ = produces a file you upload in one step (no brittle browser automation; ToS-safe).

---

## Quick start

```bash
# 1. Get the code & build
git clone https://github.com/FW1201/edu-agent-kit.git
cd edu-agent-kit
corepack enable pnpm
pnpm install && pnpm build

# 2. Scaffold your teaching knowledge base
node apps/cli/dist/index.js init --dir ~/my-teaching-wiki --template workflow \
  --name "您的稱呼" --grades "國中" --subjects "數學" --agents claude --google docs,classroom

# 3. (optional) Authorize Google — REQUIRES a one-time setup first, see below
node apps/cli/dist/index.js auth login

# 4. Check setup
node apps/cli/dist/index.js doctor
```

> ⚠️ **Before step 3 works**, you must create your own free Google OAuth client (one-time, ~5 min, in Google Cloud Console) and set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — there is no bundled default client. Full steps: **[docs/API-SETUP.md](docs/API-SETUP.md)**. `auth login` only handles the one-click consent/browser step *after* that; it does **not** replace it, and it is unrelated to any other Google login you may already have (browser, other MCP tools, etc.) — this toolkit's Google access is its own separate OAuth app.

Then connect your agent (below) and say things like *"ingest raw/這課.pdf, generate a deep 8-question quiz for 國中, and build a Kahoot import file."*

---

## Tool catalog (51 tools)

- **Content (7):** `content_ingest_source`, `content_ingest_image` (handwriting/photos via your agent's vision), `content_ingest_folder` (batch), `content_align_curriculum` (real 108課綱 dataset), `content_generate_quiz` / `_lesson` / `_board`
- **Knowledge base (3):** `wiki_list_templates`, `wiki_scaffold`, `wiki_status`
- **Word (.docx) (2):** `docx_create_lesson`, `docx_create_quiz` (student/teacher answer-key versions)
- **Interactive teach-apps (2):** `teachapp_build` (quiz/flashcards), `teachapp_deploy` (Vercel/GitHub Pages)
- **Padlet (5)** · **Google Classroom (13)**
- **Google Workspace (10):** Docs / Slides / Forms / Sheets create + `drive_create_folder` / `drive_upload_file` / `drive_set_sharing` / `drive_import_folder` (batch import) / `google_forms_read` (read-back)
- **Firebase (1):** `firebase_deploy_hosting`
- **Kahoot (3)** · **Wayground (1)** · **Wordwall (2)** · **Nearpod (1)**
- **Workflow (1):** `workflow_generate_and_distribute` (generate → deliver → distribute)

---

## Connect your agent

See **[docs/INSTALL.md](docs/INSTALL.md)** for full per-agent steps. Replace `/ABS/PATH` with your clone path.

**Claude Code (plugin — recommended):**
```
/plugin marketplace add FW1201/edu-agent-kit
/plugin install edu-agent-kit@edu-agent-kit
```
Or as a plain MCP server: `claude mcp add edu-agent-kit -- node /ABS/PATH/edu-agent-kit/apps/server/dist/index.js`

**Cursor / Codex / OpenCode / Antigravity:** add the MCP server (`node /ABS/PATH/edu-agent-kit/apps/server/dist/index.js`) to the agent's MCP config — exact JSON/TOML for each in [docs/INSTALL.md](docs/INSTALL.md).

**Remote/HTTP:** `TRANSPORT=http PORT=3000 node apps/server/dist/index.js` → `http://127.0.0.1:3000/mcp`.

---

## Credentials

All optional — missing keys only disable their own tools. Where to get each: **[docs/API-SETUP.md](docs/API-SETUP.md)**.

| Variable | For |
|----------|-----|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Docs/Slides/Forms/Sheets/Drive/Classroom |
| `PADLET_API_KEY` | Padlet |
| `KAHOOT_API_KEY` | Kahoot Reports API |
| `FIREBASE_TOKEN` / `FIREBASE_PROJECT` | Firebase Hosting |

> Web search is intentionally **not** a separate integration — use your agent's built-in web search and feed findings into `content_ingest_source` or directly into the conversation.

After you've created your own OAuth client and set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (see [docs/API-SETUP.md](docs/API-SETUP.md) — required, no client is bundled), the browser-consent step itself is one-time: `edu-agent-kit auth login` (or `node packages/adapters/google-classroom/dist/auth-cli.js`).

---

## Limitations & ToS

- **No browser automation.** Kahoot/Wayground/Wordwall/Nearpod "create" produces an official import/export file you upload in one step — a deliberate, ToS-safe choice.
- The MCP server has **no LLM of its own**: `content_generate_*` returns a *brief* for your agent to author from, then validates + depth-scores the draft.
- Google/Kahoot/Padlet/Firebase live features need their respective (sometimes paid) accounts.
- The 108課綱 alignment dataset is an extensible seed.

## Architecture

```
edu-agent-kit/                 pnpm monorepo
├── .claude-plugin/            plugin.json + marketplace.json
├── .mcp.json                  plugin MCP config
├── skills/                    5 educator skills (繁中)
├── packages/
│   ├── core/ sources/ mcp-shared/   models, ingestion, MCP utils
│   ├── wiki-kit/                     LLM-wiki scaffolder
│   └── adapters/
│       ├── google-shared/  google-classroom/  google-workspace/  firebase/
│       └── padlet/ kahoot/ wayground/ wordwall/ nearpod/
└── apps/
    ├── server/                single MCP server (51 tools)
    └── cli/                   edu-agent-kit CLI
```

## Development

```bash
pnpm build      # build all packages
pnpm test       # unit tests
pnpm typecheck  # type-check
```

## License

[MIT](LICENSE) © Kevin Wu (FW1201)
