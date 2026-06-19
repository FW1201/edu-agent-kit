# 詳細安裝指南 / Installation Guide — edu-agent-kit

本文件涵蓋環境準備、建置、各 agent 安裝方式、知識庫建立走查，以及疑難排解。
API 金鑰申請請見 [API-SETUP.md](API-SETUP.md)。

---

## 1. 環境準備 / Prerequisites

- **Node.js ≥ 18**（建議 20 或 22）。確認：`node -v`
- **pnpm**：`corepack enable pnpm`（Node 內建 corepack；或 `npm i -g pnpm`）
- **git**
- （選用）`gh` GitHub CLI、`firebase-tools`（Firebase 發布時 `npx` 會自動取得）

## 2. 取得程式並建置 / Build

```bash
git clone https://github.com/FW1201/edu-agent-kit.git
cd edu-agent-kit
pnpm install
pnpm build
```

建置完成後，MCP server 進入點為 `apps/server/dist/index.js`，CLI 為 `apps/cli/dist/index.js`。
驗證：

```bash
node apps/server/dist/index.js   # 應印出 "edu-agent-kit-server vX running on stdio (44 tools)"，Ctrl+C 結束
node apps/cli/dist/index.js doctor
```

> 之後文中的 `/絕對路徑` = 你的 clone 位置（例如 `~/Developer/edu-agent-kit`，可用 `pwd` 查）。

---

## 3. 設定環境變數 / Credentials

把 `.env.example` 複製成 `.env` 並填入你要用的金鑰（全部可選，缺哪個只停用該功能）：

```bash
cp .env.example .env
```

各金鑰申請步驟見 [API-SETUP.md](API-SETUP.md)。Google 第一次需授權：

```bash
node apps/cli/dist/index.js auth google --services docs,slides,forms,sheets,drive,classroom
```

會印出同意畫面網址；在瀏覽器登入授權後，token 會寫入 `.tokens/google-token.json`（已被 `.gitignore` 排除，請勿提交）。

---

## 4. 各 agent 安裝 / Per-agent setup

### 4.1 Claude Code

**方式 A — Plugin（建議，一鍵）**
在 Claude Code 互動視窗輸入：
```
/plugin marketplace add FW1201/edu-agent-kit
/plugin install edu-agent-kit@edu-agent-kit
```
安裝後會載入 5 個 `edu-agent-kit:*` Skills 與內含的 MCP server。
> Plugin 內的 MCP 以 `${CLAUDE_PLUGIN_ROOT}/apps/server/dist/index.js` 啟動，因此**安裝後請在 plugin 目錄執行過 `pnpm install && pnpm build`**（marketplace 取得的是原始碼）。金鑰可在 plugin 的 `.mcp.json` 或你的環境變數設定。

**方式 B — 一般 MCP server**
```bash
claude mcp add edu-agent-kit -- node /絕對路徑/edu-agent-kit/apps/server/dist/index.js
```
或在專案 `.mcp.json` / 全域 `~/.claude.json`：
```json
{
  "mcpServers": {
    "edu-agent-kit": {
      "command": "node",
      "args": ["/絕對路徑/edu-agent-kit/apps/server/dist/index.js"],
      "env": { "GOOGLE_CLIENT_ID": "...", "GOOGLE_CLIENT_SECRET": "...", "PADLET_API_KEY": "..." }
    }
  }
}
```

### 4.2 Cursor
`~/.cursor/mcp.json`（全域）或專案 `.cursor/mcp.json`：
```json
{
  "mcpServers": {
    "edu-agent-kit": {
      "command": "node",
      "args": ["/絕對路徑/edu-agent-kit/apps/server/dist/index.js"],
      "env": { "GOOGLE_CLIENT_ID": "...", "GOOGLE_CLIENT_SECRET": "..." }
    }
  }
}
```
到 **Settings → MCP** 啟用後，在 Composer 對 agent 下指令。

### 4.3 Codex
`~/.codex/config.toml`：
```toml
[mcp_servers.edu-agent-kit]
command = "node"
args = ["/絕對路徑/edu-agent-kit/apps/server/dist/index.js"]

[mcp_servers.edu-agent-kit.env]
GOOGLE_CLIENT_ID = "..."
GOOGLE_CLIENT_SECRET = "..."
```

### 4.4 OpenCode
`opencode.json`（專案）或 `~/.config/opencode/opencode.json`：
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "edu-agent-kit": {
      "type": "local",
      "command": ["node", "/絕對路徑/edu-agent-kit/apps/server/dist/index.js"],
      "environment": { "GOOGLE_CLIENT_ID": "...", "GOOGLE_CLIENT_SECRET": "..." },
      "enabled": true
    }
  }
}
```

### 4.5 Antigravity
開啟 Antigravity 的 **MCP 設定**（Agent 面板 → 管理 MCP server → 編輯設定），加入：
```json
{
  "mcpServers": {
    "edu-agent-kit": {
      "command": "node",
      "args": ["/絕對路徑/edu-agent-kit/apps/server/dist/index.js"],
      "env": { "GOOGLE_CLIENT_ID": "...", "GOOGLE_CLIENT_SECRET": "..." }
    }
  }
}
```
重新載入 server，44 個工具即可使用。

### 4.6 遠端 / 多人共用（HTTP）
```bash
TRANSPORT=http PORT=3000 node apps/server/dist/index.js
# Streamable HTTP 端點：http://127.0.0.1:3000/mcp ；健康檢查：/health
```

---

## 5. 建立教學知識庫 / Scaffold your knowledge base

互動式（會逐步詢問）：
```bash
node apps/cli/dist/index.js init
```
或一次帶旗標（非互動）：
```bash
node apps/cli/dist/index.js init --dir ~/我的教學wiki --template workflow \
  --name "您的稱呼" --grades "國中,高中" --subjects "數學,自然" \
  --agents claude,codex,cursor --platforms kahoot,nearpod --google docs,slides,classroom
```

產出內容：
- `WIKI.md`：知識庫框架說明（含 frontmatter 規範、調度指令）
- `raw/`：放原始素材（唯讀）；`wiki/`：agent 整理的知識頁（`index.md` 目錄、`log.md` 日誌）
- `memory/`：agent 記憶種子；`.cache/`：ingest 快取
- 各 agent 核心檔：`CLAUDE.md`（Claude）、`AGENTS.md`（Codex/OpenCode）、`GEMINI.md`（Gemini/Antigravity）、`.cursor/rules/edu-agent-kit.mdc`（Cursor）
- `.mcp.json`：把此知識庫接上 edu-agent-kit MCP

接著：把素材丟進 `raw/`，對 agent 說「ingest raw/...」開始整理。

---

## 6. 疑難排解 / Troubleshooting

- **`pnpm: command not found`** → `corepack enable pnpm`
- **build 失敗** → 確認 Node ≥ 18；`pnpm install` 後重試 `pnpm build`
- **工具回「Missing credential」** → 該功能需金鑰；見 [API-SETUP.md](API-SETUP.md)，或先用不需金鑰的功能（生成 brief、產匯入檔、wiki scaffold）
- **Google 授權失敗 / 無 refresh token** → 到 https://myaccount.google.com/permissions 撤銷後重跑 `auth google`
- **plugin 載入但工具沒出現** → 確認已在 plugin 目錄 `pnpm install && pnpm build`；用 `/reload-plugins`
- **檢查整體狀態** → `node apps/cli/dist/index.js doctor`
