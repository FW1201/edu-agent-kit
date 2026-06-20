import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import {
  scaffoldWiki,
  listTemplates,
  ALL_AGENTS,
  type AgentId,
  type ScaffoldOptions,
} from "@edu-agent-kit/wiki-kit";

function csv(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

const GOOGLE_SERVICES = ["docs", "slides", "forms", "sheets", "drive", "classroom", "firebase"];
const PLATFORMS = ["kahoot", "wayground", "wordwall", "nearpod", "padlet"];

export async function runInit(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      dir: { type: "string" },
      template: { type: "string" },
      name: { type: "string" },
      grades: { type: "string" },
      subjects: { type: "string" },
      agents: { type: "string" },
      platforms: { type: "string" },
      google: { type: "string" },
      yes: { type: "boolean" },
      overwrite: { type: "boolean" },
    },
    allowPositionals: true,
  });

  const interactive = !values.yes && !values.template && Boolean(process.stdout.isTTY);

  let opts: ScaffoldOptions;
  if (interactive) {
    p.intro("edu-agent-kit — 建立教學知識庫");
    const template = await p.select({
      message: "選擇知識庫結構範本",
      options: listTemplates().map((t) => ({ value: t.id, label: t.title, hint: t.description })),
    });
    if (p.isCancel(template)) return p.cancel("已取消"), undefined;
    const dir = await p.text({ message: "建立位置（資料夾路徑）", placeholder: ".", defaultValue: "." });
    if (p.isCancel(dir)) return p.cancel("已取消"), undefined;
    const name = await p.text({ message: "老師稱呼（可留空）", defaultValue: "" });
    if (p.isCancel(name)) return p.cancel("已取消"), undefined;
    const grades = await p.text({ message: "學制/年級（逗號分隔，可留空）", defaultValue: "" });
    if (p.isCancel(grades)) return p.cancel("已取消"), undefined;
    const subjects = await p.text({ message: "科目（逗號分隔，可留空）", defaultValue: "" });
    if (p.isCancel(subjects)) return p.cancel("已取消"), undefined;
    const agents = await p.multiselect({
      message: "要為哪些 agent 產生 memory/核心檔？",
      options: ALL_AGENTS.map((a) => ({ value: a, label: a })),
      initialValues: ["claude"] as AgentId[],
      required: true,
    });
    if (p.isCancel(agents)) return p.cancel("已取消"), undefined;
    const platforms = await p.multiselect({
      message: "常用課堂平台（可不選）",
      options: PLATFORMS.map((x) => ({ value: x, label: x })),
      required: false,
    });
    if (p.isCancel(platforms)) return p.cancel("已取消"), undefined;
    const google = await p.multiselect({
      message: "啟用的 Google 服務（可不選）",
      options: GOOGLE_SERVICES.map((x) => ({ value: x, label: x })),
      required: false,
    });
    if (p.isCancel(google)) return p.cancel("已取消"), undefined;

    opts = {
      targetDir: String(dir) || ".",
      templateId: String(template),
      overwrite: Boolean(values.overwrite),
      profile: {
        teacherName: String(name) || undefined,
        gradeLevels: csv(String(grades)),
        subjects: csv(String(subjects)),
        agents: agents as AgentId[],
        platforms: platforms as string[],
        googleServices: google as string[],
      },
    };
  } else {
    opts = {
      targetDir: values.dir ?? ".",
      templateId: values.template ?? "workflow",
      overwrite: Boolean(values.overwrite),
      profile: {
        teacherName: values.name,
        gradeLevels: csv(values.grades),
        subjects: csv(values.subjects),
        platforms: csv(values.platforms),
        googleServices: csv(values.google),
        agents: (csv(values.agents) as AgentId[] | undefined) ?? ["claude"],
      },
    };
  }

  const res = await scaffoldWiki(opts);
  const summary = [
    `知識庫已建立：${res.targetDir}（範本：${res.templateId}）`,
    `  資料夾：${res.createdDirs.length}　檔案：${res.createdFiles.length}　略過：${res.skipped.length}`,
    `下一步：1) edu-agent-kit auth login  2) 把素材放進 raw/  3) 對 agent 說「ingest raw/...」`,
  ].join("\n");
  if (interactive) p.outro(summary);
  else process.stdout.write(summary + "\n");
}
