---
name: edu-wiki-init
description: 建立或客製化教育工作者的本地教學知識庫（LLM-wiki）。當老師說「建立教學知識庫」「幫我整理教材資料夾」「設定我的教學 wiki」「初始化知識庫」「客製我的資料夾結構」時使用。
---

# 建立教學知識庫（edu-agent-kit）

協助台灣老師建立一個本地知識庫，把教材/教學資料梳理保存，並作為 agent 調度中樞。

## 步驟

1. **了解需求**：詢問（或從對話推斷）老師的：學制/年級、科目、常用課堂平台（kahoot/padlet/nearpod…）、要啟用的 Google 服務（docs/slides/forms/sheets/drive/classroom/firebase）、使用哪些 agent（claude/codex/gemini/cursor/opencode）。
2. **選範本**：
   - **教學工作流導向**（workflow）：備課/教材/評量/班級經營/行政 分資料夾——最貼近日常。
   - **單一教師精簡版**（minimal）：raw/wiki/log 三層核心，最大彈性。
3. **建立**：執行 CLI（最可靠）：
   ```bash
   edu-agent-kit init --dir <資料夾> --template workflow \
     --name "老師" --grades "國中" --subjects "數學" \
     --agents claude,codex --platforms kahoot,nearpod --google docs,classroom
   ```
   或用 MCP 工具 `wiki_scaffold`（若已掛載 server）。
4. **說明產出**：建立後會有 `WIKI.md`（框架說明）、`wiki/`（index.md 目錄、log.md 日誌）、`raw/`（放素材）、`memory/`、各 agent 的核心檔（CLAUDE.md/AGENTS.md/GEMINI.md/.cursor）與 `.mcp.json`。
5. **下一步引導**：1) `edu-agent-kit auth google` 授權；2) 把素材放進 `raw/`；3) 用 `edu-wiki-ops` 的 ingest 把素材整理進知識庫。

## 原則
- 繁體中文（台灣用語）。raw/ 唯讀；不覆蓋既有檔案（除非老師要求）。
- 客製化資料夾：可在既有範本上增刪資料夾，但保留 raw/wiki/log 三層核心。
