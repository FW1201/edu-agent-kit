---
name: edu-build-quiz
description: 為台灣老師生成有深度的測驗題組，並輸出成 Kahoot/Wayground 匯入檔或 Google Form。當老師說「出一份小考」「做 Kahoot 題目」「生成測驗」「做一份 Quizizz/Wayground 測驗」「把這課做成 Google 表單測驗」時使用。
---

# 生成深度題組並輸出（edu-agent-kit）

## 步驟

1. **取材**：若老師指定 raw/ 素材或檔案/URL，先用 `content_ingest_source`；需要補充時用 `content_web_research`。可用 `content_align_curriculum` 對齊 108 課綱。
2. **生成（兩步）**：
   - 先呼叫 `content_generate_quiz`（不帶 draftQuestions）取得「生成 brief」（含 Bloom 分布與深度要求）。
   - 依 brief 撰寫題目（每題設 bloomLevel、解析 explanation、選擇題誘答 rationale、開放題 rubric），再呼叫 `content_generate_quiz` 帶上 `draftQuestions` 進行驗證與深度評分。若深度分數低或有 warnings，**重生成**淺題。
3. **輸出**（依老師選擇）：
   - Kahoot → `kahoot_build_import_xlsx`（產 .xlsx，老師上傳）
   - Wayground/Quizizz → `wayground_build_import_spreadsheet`
   - Google 表單測驗 → `google_forms_create_from_quiz`（自動設為計分測驗）
   - 題庫存檔 → `google_sheets_create`（quiz 模式）
4. **回報**：給出檔案路徑或連結，並提醒下一步（上傳或派送到 Classroom）。

## 原則
- 繁中、對齊年級與科目。深度優先：高階 Bloom 比例 ≥40%、每題有解析。
- 平台限制（如 Kahoot 字數、Wayground 純文字）由工具自動處理並回報 warnings。
