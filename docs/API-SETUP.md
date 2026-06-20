# API 金鑰申請指南 / API Setup — edu-agent-kit

每個整合的金鑰都是**可選的**——只有用到該平台時才需要，缺少時只會停用對應工具。
設定方式：把金鑰填入專案根目錄的 `.env`（由 `.env.example` 複製），或填入各 agent MCP 設定的 `env` 區塊。

| 平台 | 需要的變數 | 是否免費 |
|------|-----------|---------|
| Google（Docs/Slides/Forms/Sheets/Drive/Classroom） | `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` | 免費 |
| Padlet | `PADLET_API_KEY` | 需 Padlet 訂閱 |
| Kahoot Reports API | `KAHOOT_API_KEY` | 需 EDU/企業方案 |
| Firebase Hosting | `FIREBASE_TOKEN`、`FIREBASE_PROJECT` | 免費方案可用 |

> 補充：取材時若需要查網路上的最新資訊，直接用你 agent（Claude/Cursor/Codex…）內建的網路搜尋能力即可，不需要為此額外申請 API 金鑰——把找到的內容餵給 `content_ingest_source`（檔案/URL）或直接整理進對話即可。

---

## 1. Google（Docs / Slides / Forms / Sheets / Drive / Classroom）

一組 OAuth 用戶端即可涵蓋全部 Google 功能。

1. 前往 **Google Cloud Console**：https://console.cloud.google.com/
2. 建立（或選擇）一個專案。
3. **啟用 API**：APIs & Services → Library，逐一啟用你要用的：
   - Google Docs API、Google Slides API、Google Forms API、Google Sheets API、Google Drive API、Google Classroom API
4. **設定 OAuth 同意畫面**：APIs & Services → OAuth consent screen → External → 填寫應用名稱/聯絡信箱 → 在 Test users 加入你自己的 Google 帳號。
5. **建立憑證**：APIs & Services → Credentials → Create Credentials → **OAuth client ID** → Application type 選 **Desktop app** → 建立。
6. 複製 **Client ID** 與 **Client secret**，填入 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`。
7. 一次性授權：
   ```bash
   node apps/cli/dist/index.js auth google --services docs,slides,forms,sheets,drive,classroom
   ```
   依畫面網址登入授權；token 會存到 `.tokens/google-token.json`。
   > 預設 redirect 為 `http://localhost:3000/oauth2callback`；如需更改，設 `GOOGLE_REDIRECT_URI` 並在 OAuth client 的「Authorized redirect URIs」加入同一網址。

採用最小權限：Drive 僅用 `drive.file`（只能存取本工具建立/開啟的檔案）。

---

## 2. Padlet

1. 需要 Padlet 付費方案。
2. 前往 **開發者設定**：https://padlet.com/dashboard/settings/developers
3. 產生 API key，填入 `PADLET_API_KEY`。
- 文件：https://docs.padlet.dev/

---

## 3. Kahoot Reports API（成績分析，唯讀）

1. 需要 Kahoot **EDU / 企業方案**（一般免費帳號沒有 Reports API）。
2. 取得 API token，填入 `KAHOOT_API_KEY`。
- 指南：https://support.kahoot.com/hc/en-us/articles/11735948502931-Guide-to-Kahoot-reports-API
> 注意：Kahoot **沒有**建立測驗的 API；建立題目是用本工具產生的 `.xlsx` 匯入檔（不需金鑰）。Reports API 只用於把成績抓出來分析。

---

## 4. Firebase Hosting（發布互動教材網頁）

1. 前往 **Firebase Console**：https://console.firebase.google.com/ 建立專案，記下 **Project ID** → 填入 `FIREBASE_PROJECT`。
2. 安裝 CLI 並取得部署 token：
   ```bash
   npm install -g firebase-tools
   firebase login:ci      # 登入後會印出一組 token
   ```
   把 token 填入 `FIREBASE_TOKEN`。
3. 之後 `firebase_deploy_hosting` 會用 `npx firebase-tools` 部署，回傳 `https://<project>.web.app` 網址。
- 文件：https://firebase.google.com/docs/hosting

---

## 安全提醒 / Security

- **切勿把金鑰或 `.tokens/` 提交到 git**（`.gitignore` 已排除 `.env`、`.tokens/`、token 檔）。
- 對外發布/派送（Classroom 作業、Drive 分享、Firebase 網頁）前，請確認對象與內容。
- 用 `node apps/cli/dist/index.js auth status` 或 `doctor` 檢查目前已設定哪些憑證。
