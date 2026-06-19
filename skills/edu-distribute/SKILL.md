---
name: edu-distribute
description: 把做好的教學內容派送給學生——建立 Google Classroom 作業、上傳到 Drive、或用 Firebase 發布成網頁。當老師說「派作業」「發到 Classroom」「上傳到雲端硬碟」「把教材發布成網頁」「分享給學生」時使用。
---

# 派送教學內容（edu-agent-kit）

## 路徑

1. **Google Classroom**（最常用）：
   - 建作業：`classroom_create_coursework`（可附連結/Drive/YouTube/表單；可設配分、截止日、主題）。
   - 發教材/公告：`classroom_create_material` / `classroom_post_announcement`。
   - 名冊與批改：`classroom_list_students`、`classroom_list_submissions`、`classroom_return_grade`。
2. **Drive**：把本地產出（Kahoot .xlsx、Nearpod .pptx）`drive_upload_file`，必要時 `drive_create_folder` + `drive_set_sharing`。
3. **Firebase 發布**：把互動教材 HTML 用 `firebase_deploy_hosting` 發布成網頁（需 FIREBASE_TOKEN + 專案），回傳網址。
4. **一條龍**：用 `workflow_generate_and_distribute` 一次「產出平台檔/看板 → 建 Classroom 作業」。

## 原則
- 先確認憑證（`edu-agent-kit auth status` / `doctor`）。缺憑證時清楚告知去哪申請（見 docs/API-SETUP.md）。
- 對外發佈/派送前向老師確認對象與內容。
