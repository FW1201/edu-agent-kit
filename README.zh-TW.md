# edu-agent-kit（教育工作者 agent 知識庫與工具組）

> 給老師的 agent 知識庫與內容工具：在本機建立**教學 LLM-wiki**、用自己的素材生成**有深度的教學內容**，並輸出/派送到 **Kahoot、Padlet、Nearpod、Wordwall、Wayground、Google Workspace、Google Classroom、Firebase**。支援任何 MCP agent。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**English: [README.md](README.md)** ｜ 詳細安裝：[docs/INSTALL.md](docs/INSTALL.md) ｜ API 申請：[docs/API-SETUP.md](docs/API-SETUP.md)

可搭配 **Claude Code、Cursor、Codex、OpenCode、Antigravity** 及任何 MCP 用戶端。

---

## 這個工具解決什麼

課堂工具內建的 AI 產出內容太淺、無法接上 agent 工作流、也很難吃進你自己的教材。edu-agent-kit 把整條流程打通：

1. **本地 LLM-wiki**：一鍵建立教學知識庫（範本化資料夾、agent 記憶/`CLAUDE.md`、調度指令），讓 agent 把「素材 → 知識庫 → 生成 → 輸出」整條串起來。
2. **深度內容生成**：吃進檔案/網址/網路搜尋，對齊 108 課綱，生成測驗/課程/看板，並做**驗證與 Bloom 深度評分**。
3. **高保真輸出**：每個平台用最合適的官方路徑（有 API 走 API，沒有就產官方匯入/匯出檔），外加完整 Google Workspace + Classroom + Firebase 輸出。

### 四種介面（跨 agent）

| 介面 | 內容 | 適用 |
|------|------|------|
| **MCP server** | 43 個工具 | 通用層——所有 agent |
| **CLI**（`edu-agent-kit`） | 建知識庫、Google 授權、輸出、doctor | 任何終端機/agent |
| **Skills** | 5 個教師工作流（繁中） | Claude 及支援 skill 的 agent |
| **Claude Code Plugin** | 一鍵套件（MCP + skills） | Claude 生態 |

### 平台支援

| 平台 | 建立 | 讀取 |
|------|------|------|
| **Padlet** | ✅ 官方 API（看板＋貼文） | ✅ |
| **Google Classroom** | ✅ 官方 API（作業/教材/名冊/批改） | ✅ |
| **Google Docs / Slides / Forms / Sheets** | ✅ 官方 API | — |
| **Google Drive** | ✅ 建資料夾、上傳、分享 | — |
| **Firebase Hosting** | ✅ 把教材發布成網頁 | — |
| **Kahoot!** | ⬇️ 官方 `.xlsx` 匯入檔 | ✅ Reports API |
| **Wayground（Quizizz）** | ⬇️ 官方試算表匯入 | — |
| **Wordwall** | ⬇️ 範本內容檔 | ✅ oEmbed |
| **Nearpod** | ⬇️ Google Slides `.pptx` | — |

⬇️ = 產生一個檔案，你上傳一次即可（不做脆弱的瀏覽器自動化，符合服務條款）。

---

## 快速開始

```bash
# 1. 取得程式並 build
git clone https://github.com/FW1201/edu-agent-kit.git
cd edu-agent-kit
corepack enable pnpm
pnpm install && pnpm build

# 2. 建立你的教學知識庫
node apps/cli/dist/index.js init --dir ~/我的教學wiki --template workflow \
  --name "您的稱呼" --grades "國中" --subjects "數學" --agents claude --google docs,classroom

# 3.（選用）授權 Google
node apps/cli/dist/index.js auth google --services docs,slides,forms,sheets,drive,classroom

# 4. 檢查環境
node apps/cli/dist/index.js doctor
```

接著掛上你的 agent（見下），就能說：「ingest raw/這課.pdf，幫國中生出 8 題有深度的小考，並做成 Kahoot 匯入檔。」

> 範本二選一：`workflow`（備課/教材/評量/班級經營/行政 分資料夾，最貼近日常）或 `minimal`（raw/wiki/log 三層核心，最大彈性）。

---

## 各 agent 安裝方式

完整步驟見 **[docs/INSTALL.md](docs/INSTALL.md)**。以下 `/絕對路徑` 請換成你 clone 的位置。

### Claude Code（建議用 plugin）
```
/plugin marketplace add FW1201/edu-agent-kit
/plugin install edu-agent-kit@edu-agent-kit
```
或當作一般 MCP server：
```bash
claude mcp add edu-agent-kit -- node /絕對路徑/edu-agent-kit/apps/server/dist/index.js
```

### Cursor
`~/.cursor/mcp.json`（全域）或專案 `.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "edu-agent-kit": {
      "command": "node",
      "args": ["/絕對路徑/edu-agent-kit/apps/server/dist/index.js"],
      "env": { "GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": "", "PADLET_API_KEY": "" }
    }
  }
}
```

### Codex
`~/.codex/config.toml`：
```toml
[mcp_servers.edu-agent-kit]
command = "node"
args = ["/絕對路徑/edu-agent-kit/apps/server/dist/index.js"]

[mcp_servers.edu-agent-kit.env]
GOOGLE_CLIENT_ID = ""
GOOGLE_CLIENT_SECRET = ""
```

### OpenCode
`opencode.json` 或 `~/.config/opencode/opencode.json`：
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "edu-agent-kit": {
      "type": "local",
      "command": ["node", "/絕對路徑/edu-agent-kit/apps/server/dist/index.js"],
      "environment": { "GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": "" },
      "enabled": true
    }
  }
}
```

### Antigravity
在 Antigravity 的 **MCP 設定**（Agent 面板 → 管理 MCP server → 編輯設定）加入：
```json
{
  "mcpServers": {
    "edu-agent-kit": {
      "command": "node",
      "args": ["/絕對路徑/edu-agent-kit/apps/server/dist/index.js"],
      "env": { "GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": "" }
    }
  }
}
```

### 遠端 / HTTP 模式
```bash
TRANSPORT=http PORT=3000 node apps/server/dist/index.js   # → http://127.0.0.1:3000/mcp
```

---

## 憑證（API 金鑰）

全部可選——缺哪個只會停用該功能，其他照常。各金鑰去哪申請：**[docs/API-SETUP.md](docs/API-SETUP.md)**。

| 變數 | 用途 |
|------|------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Docs/Slides/Forms/Sheets/Drive/Classroom |
| `PADLET_API_KEY` | Padlet |
| `KAHOOT_API_KEY` | Kahoot Reports API（成績分析） |
| `FIREBASE_TOKEN` / `FIREBASE_PROJECT` | Firebase 發布 |

> 網路搜尋刻意**不**做成額外整合——直接用你的 agent（Claude/Cursor/Codex…）內建的網路搜尋能力，把找到的內容餵給 `content_ingest_source` 或直接整理進對話即可，不需要額外申請金鑰。

Google 授權只需一次：`edu-agent-kit auth google`（或 `node packages/adapters/google-classroom/dist/auth-cli.js`）。把 `.env.example` 複製成 `.env` 填入即可。

---

## 工具總覽（43 個）

- **內容生成（5）**：`content_ingest_source`、`content_align_curriculum`、`content_generate_quiz`/`_lesson`/`_board`
- **知識庫（3）**：`wiki_list_templates`、`wiki_scaffold`、`wiki_status`
- **Padlet（5）** · **Google Classroom（13）** · **Google Workspace（8）**：Docs/Slides/Forms/Sheets + Drive 建資料夾/上傳/分享
- **Firebase（1）**：`firebase_deploy_hosting`
- **Kahoot（3）** · **Wayground（1）** · **Wordwall（2）** · **Nearpod（1）**
- **一條龍（1）**：`workflow_generate_and_distribute`（生成 → 產出 → 派送）

---

## 教師 Skills（繁中）

- `edu-wiki-init` — 建立/客製教學知識庫
- `edu-build-quiz` — 生成深度題組 → Kahoot/Wayground/Google 表單
- `edu-build-lesson` — 生成互動課程 → Nearpod/Slides/Doc
- `edu-distribute` — 派送到 Classroom / Drive / Firebase
- `edu-wiki-ops` — 知識庫調度（ingest/query/status/lint/export）

---

## 限制與服務條款

- **不做瀏覽器自動化**：Kahoot/Wayground/Wordwall/Nearpod 的「建立」止於產生官方匯入/匯出檔，你上傳一次即可——這是刻意、符合 ToS 的取捨。
- MCP server **本身沒有 LLM**：`content_generate_*` 會回一份「生成 brief」讓你的 agent 撰寫，再驗證與深度評分。
- Google/Kahoot/Padlet/Firebase 的線上功能需各自帳號（部分需付費方案）。
- 108 課綱對齊資料為可擴充的種子資料。

## 授權

[MIT](LICENSE) © Kevin Wu (FW1201)
