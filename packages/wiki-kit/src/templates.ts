import type { WikiTemplate } from "./types.js";

/**
 * Built-in LLM-wiki templates for Taiwanese educators. Both keep the raw/ →
 * wiki/ → log core; they differ in how teaching material is foldered. Teachers
 * can add more folders via ScaffoldOptions.extraFolders.
 */
export const TEMPLATES: WikiTemplate[] = [
  {
    id: "workflow",
    title: "教學工作流導向",
    description:
      "依教學工作流分資料夾：備課 / 教材 / 評量 / 班級經營 / 行政。最貼近一般老師日常。",
    folders: [
      "raw/備課",
      "raw/教材",
      "raw/評量",
      "raw/班級經營",
      "raw/行政",
      "wiki/備課",
      "wiki/教材",
      "wiki/評量",
      "wiki/班級經營",
      "wiki/行政",
      "wiki/queries",
      "memory",
      ".cache",
    ],
  },
  {
    id: "minimal",
    title: "單一教師精簡版",
    description:
      "最少結構、最大彈性：raw / wiki / log 三層核心，老師再自行長出資料夾。",
    folders: ["raw", "wiki", "wiki/queries", "memory", ".cache"],
  },
];

export function listTemplates(): WikiTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): WikiTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
