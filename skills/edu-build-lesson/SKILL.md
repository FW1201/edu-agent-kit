---
name: edu-build-lesson
description: 為台灣老師生成互動課程，並輸出成 Nearpod 投影片、Google Slides 或 Google Doc 講義。當老師說「做一堂互動課」「生成課程簡報」「做 Nearpod 課程」「把這單元做成 Slides/講義」「做學習單」時使用。
---

# 生成互動課程並輸出（edu-agent-kit）

## 步驟

1. **取材**：必要時用 `content_ingest_source` 讀檔案/URL；補充資訊可直接用你（agent）內建的網路搜尋能力查詢，再用 `content_align_curriculum` 對齊 108 課綱。
2. **生成（兩步）**：
   - 先 `content_generate_lesson`（不帶 draftSlides）取得 brief（要求主動學習檢核點、嵌入形成性評量、講者備註）。
   - 依 brief 撰寫 slides，再 `content_generate_lesson` 帶 `draftSlides` 驗證；補齊缺少的學習目標/評量檢核點。
3. **輸出**（依老師選擇）：
   - Nearpod → `nearpod_build_slides_export`（產生 Google Slides 相容 .pptx，老師匯入 Google Slides 後用 Nearpod 外掛加入）
   - Google Slides → `google_slides_create_from_lesson`（直接建簡報）
   - 講義 Google Doc → `google_docs_create_from_lesson`
4. **回報**：給出連結/路徑與匯入步驟。

## 原則
- 繁中、對齊年級科目。課程要有主動學習節奏（每 3-4 張一個活動/評量）。
