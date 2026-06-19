---
name: edu-wiki-ops
description: 操作教學知識庫的調度指令——把素材整理入庫、查詢、統計、健檢、輸出。當老師說「ingest」「把這份資料整理進知識庫」「查一下我的知識庫」「知識庫統計」「健檢知識庫」「整理 raw 資料」時使用。
---

# 知識庫調度（edu-agent-kit LLM-wiki）

先讀知識庫根目錄的 `WIKI.md` 與 `wiki/index.md` 定位結構，再執行：

## 指令

- **ingest <path>**：讀 `raw/` 指定素材（PDF/DOCX/MD…，可用 `content_ingest_source`）→ 在 `wiki/` 對應分區建立知識頁（含 frontmatter）→ 更新 `wiki/index.md` → 追加 `wiki/log.md`。
- **query <問題>**：讀 index 定位相關頁 → 綜合回答並標註來源頁。可接著 export 把答案做成成品。
- **status**：統計頁數、各分區、最後更新，輸出簡表。
- **lint**：健檢死連結、孤立頁、缺必填 frontmatter 的頁面，列出建議。
- **export <target>**：把知識庫內容輸出/派送 — doc/slides/form/sheet/kahoot/wayground/wordwall/nearpod/classroom/firebase（呼叫對應 edu-agent-kit 工具，或 `edu-build-quiz`/`edu-build-lesson`/`edu-distribute`）。

## 原則
- 繁中。raw/ 唯讀；log.md 只追加；每次 ingest 後更新 index。
- 結構不明時先讀 WIKI.md，不要臆測資料夾。
