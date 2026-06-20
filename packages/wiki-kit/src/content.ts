import type { AgentId, WikiProfile, WikiTemplate } from "./types.js";

const TODAY = (): string => new Date().toISOString().slice(0, 10);

/** Knowledge-base dispatch commands (調度指令) the agent honors. */
export const DISPATCH: { cmd: string; desc: string }[] = [
  { cmd: "ingest <path>", desc: "讀取 raw/ 素材，整理成 wiki/ 知識頁，更新 index 與 log" },
  { cmd: "query <問題>", desc: "檢索知識庫回答問題；可接 export 直接輸出成果" },
  { cmd: "status", desc: "輸出知識庫統計（頁數、各分區、最後更新）" },
  { cmd: "lint", desc: "健檢：死連結、孤立頁、缺 frontmatter 的頁面" },
  {
    cmd: "export <target>",
    desc: "把內容輸出/派送：doc | slides | form | sheet | kahoot | wayground | wordwall | nearpod | classroom | firebase（呼叫 edu-agent-kit MCP）",
  },
];

function profileLines(profile: WikiProfile): string[] {
  const lines: string[] = [];
  if (profile.teacherName) lines.push(`- 老師：${profile.teacherName}`);
  if (profile.gradeLevels?.length) lines.push(`- 學制/年級：${profile.gradeLevels.join("、")}`);
  if (profile.subjects?.length) lines.push(`- 科目：${profile.subjects.join("、")}`);
  if (profile.platforms?.length) lines.push(`- 課堂平台：${profile.platforms.join("、")}`);
  if (profile.googleServices?.length) lines.push(`- Google 服務：${profile.googleServices.join("、")}`);
  return lines.length ? lines : ["- （尚未填寫教師檔案，可自行補上）"];
}

/** The WIKI.md schema/framework doc for the generated knowledge base. */
export function wikiMd(template: WikiTemplate, profile: WikiProfile): string {
  return [
    `# 教學知識庫（edu-agent-kit LLM-wiki）`,
    `# 範本：${template.title}（${template.id}）｜建立：${TODAY()}`,
    ``,
    `## 這是什麼`,
    `這是一個給教育工作者的本地知識庫，幫助你把教材、教學資料梳理、保存，並作為 AI agent 的調度中樞——讓 agent 依據你的素材生成有深度的教學內容，並透過 edu-agent-kit 工具輸出到 Kahoot/Padlet/Nearpod/Google/Classroom 等平台。`,
    ``,
    `## 教師檔案`,
    ...profileLines(profile),
    ``,
    `## 目錄結構`,
    "```",
    ...template.folders.map((f) => `${f}/`),
    "```",
    `- raw/：原始素材（唯讀，請勿改動原檔）`,
    `- wiki/：agent 整理的知識頁（含 index.md 目錄、log.md 操作日誌）`,
    `- memory/：agent 記憶（長期偏好、專案脈絡）`,
    `- .cache/：ingest 快取（可忽略）`,
    ``,
    `## 頁面 frontmatter 規範`,
    "```yaml",
    "---",
    "title: 頁面標題",
    "type: source-summary | concept | synthesis | lesson | assessment | query",
    "category: 對應資料夾（如 教材 / 評量）",
    "tags: [標籤]",
    "created: YYYY-MM-DD",
    "updated: YYYY-MM-DD",
    "sources: [raw/路徑]",
    "related: [slug]",
    "---",
    "```",
    ``,
    `## 調度指令（對 agent 說這些，或用 edu-agent-* Skills）`,
    ...DISPATCH.map((d) => `- **${d.cmd}** — ${d.desc}`),
    ``,
    `## 與 edu-agent-kit 工具的銜接`,
    `- 生成：content_generate_quiz / content_generate_lesson / content_generate_board`,
    `- 輸出：kahoot/wayground/wordwall/nearpod 匯入檔、google_docs/slides/forms/sheets、drive 上傳、firebase 發布`,
    `- 派送：classroom_create_coursework、workflow_generate_and_distribute`,
    `- MCP 連線設定見 .mcp.json；安裝與 API 申請見專案 docs/INSTALL.md、docs/API-SETUP.md`,
    ``,
    `## 規則`,
    `1. raw/ 唯讀，不改原始素材。2. log.md 只追加。3. 每次 ingest 後更新 index.md。`,
  ].join("\n");
}

export function indexMd(template: WikiTemplate): string {
  return [
    `# 知識庫目錄`,
    `# 最後更新：${TODAY()}`,
    ``,
    `> 範本：${template.title}。每新增一頁，於對應分區加一行：\`- [標題](路徑) — 簡述\`。`,
    ``,
    ...(template.id === "workflow"
      ? ["## 備課", "", "## 教材", "", "## 評量", "", "## 班級經營", "", "## 行政", "", "## 查詢保存 (queries/)", ""]
      : ["## 知識頁", "", "## 查詢保存 (queries/)", ""]),
  ].join("\n");
}

export function logMd(): string {
  return [`# 操作日誌（append-only）`, `# 禁止刪除歷史記錄`, ``, `---`, ``, `## [${TODAY()}] init | 知識庫建立`, ``].join("\n");
}

export function manifestJson(): string {
  return JSON.stringify({ version: "1.0", created: TODAY(), entries: {} }, null, 2);
}

export function memorySeed(profile: WikiProfile): string {
  return [
    `---`,
    `name: teacher-profile`,
    `description: 這個知識庫擁有者的教學背景與偏好`,
    `metadata:`,
    `  type: user`,
    `---`,
    ``,
    ...profileLines(profile),
    ``,
    `**How to apply:** 生成教學內容時對齊上述學制/科目；輸出優先採用老師慣用的平台。`,
  ].join("\n");
}

/** MCP server config snippet so the knowledge base connects to edu-agent-kit. */
export function mcpJson(serverEntry = "edu-agent-kit-server"): string {
  return JSON.stringify(
    {
      mcpServers: {
        "edu-agent-kit": {
          command: serverEntry,
          args: [],
          env: {
            PADLET_API_KEY: "",
            GOOGLE_CLIENT_ID: "",
            GOOGLE_CLIENT_SECRET: "",
            KAHOOT_API_KEY: "",
            FIREBASE_TOKEN: "",
            FIREBASE_PROJECT: "",
          },
        },
      },
    },
    null,
    2,
  );
}

/** Canonical agent guidance written into each selected agent's memory file. */
export function agentGuide(profile: WikiProfile, template: WikiTemplate): string {
  return [
    `# 教學知識庫 — Agent 工作指南（edu-agent-kit）`,
    ``,
    `你在協助一位台灣教育工作者管理本地教學知識庫並產出教學內容。`,
    ``,
    `## 教師檔案`,
    ...profileLines(profile),
    ``,
    `## 知識庫結構（範本：${template.title}）`,
    `- raw/ 原始素材（唯讀）、wiki/ 知識頁（index.md 目錄、log.md 日誌）、memory/ 記憶、.cache/`,
    `- 詳見 WIKI.md。`,
    ``,
    `## 調度指令（使用者可能這樣說）`,
    ...DISPATCH.map((d) => `- **${d.cmd}** — ${d.desc}`),
    ``,
    `## 工作原則`,
    `1. 用繁體中文（台灣用語）。`,
    `2. ingest：讀 raw/ 素材→在 wiki/ 對應分區建頁（含 frontmatter）→更新 index.md→追加 log.md。`,
    `3. 生成教學內容時優先呼叫 edu-agent-kit MCP 的 content_generate_*（會做 Bloom 深度檢查），再用平台/Google 工具輸出。`,
    `4. raw/ 唯讀；log.md 只追加。`,
    `5. 不確定結構時，先讀 WIKI.md 與 wiki/index.md。`,
    ``,
    `## 可用工具（edu-agent-kit MCP，見 .mcp.json）`,
    `- 生成：content_generate_quiz / lesson / board；ingest/align（網路搜尋取材請直接用 agent 自身內建能力）`,
    `- 平台：kahoot / wayground / wordwall / nearpod 匯入匯出；padlet API；classroom_*`,
    `- Google：google_docs/slides/forms/sheets、drive_*；firebase_deploy_hosting`,
    `- 一條龍：workflow_generate_and_distribute`,
  ].join("\n");
}

/** Cursor rule file needs frontmatter. */
function cursorRule(body: string): string {
  return [`---`, `description: 教學知識庫 agent 指南（edu-agent-kit）`, `alwaysApply: true`, `---`, ``, body].join("\n");
}

/** Files to write for the selected agents (deduped). */
export function agentFiles(
  profile: WikiProfile,
  template: WikiTemplate,
): { path: string; content: string }[] {
  const guide = agentGuide(profile, template);
  const out: { path: string; content: string }[] = [];
  const agents = new Set<AgentId>(profile.agents);
  if (agents.has("claude")) out.push({ path: "CLAUDE.md", content: guide });
  if (agents.has("codex") || agents.has("opencode")) out.push({ path: "AGENTS.md", content: guide });
  if (agents.has("gemini")) out.push({ path: "GEMINI.md", content: guide });
  if (agents.has("cursor")) out.push({ path: ".cursor/rules/edu-agent-kit.mdc", content: cursorRule(guide) });
  return out;
}
