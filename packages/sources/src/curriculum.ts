import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CurriculumAlignment } from "@edu-agent-kit/core";

/**
 * 108 課綱 alignment, backed by the real core-competencies dataset bundled at
 * `data/108-core-competencies.md` (9 domains × 5 learning stages, sourced from
 * the MIT-licensed tw-edu-skills by the same author). The seed table below
 * provides domain aliases + sample objectives; competency codes are parsed live.
 */

interface DomainSeed {
  domain: string;
  /** Prefix used in 108 codes (語/數/自/健體/科技/…). */
  prefix: string;
  aliases: string[];
  sampleObjectives: string[];
}

const DOMAIN_SEEDS: DomainSeed[] = [
  { domain: "國語文", prefix: "語", aliases: ["國語", "語文", "chinese", "國文"], sampleObjectives: ["能分析文本結構與寫作手法", "能比較不同文本觀點並提出評價", "能依情境調整語言表達策略"] },
  { domain: "英語文", prefix: "英", aliases: ["英語", "english", "英文", "efl", "esl"], sampleObjectives: ["能理解並摘要主旨與細節", "能依情境進行口語與書面表達", "能比較中英文化差異並適切回應"] },
  { domain: "數學", prefix: "數", aliases: ["math", "mathematics", "算數"], sampleObjectives: ["能將真實情境轉化為數學模型", "能說明解題策略並驗證合理性", "能比較多種解法的效率"] },
  { domain: "自然科學", prefix: "自", aliases: ["自然", "science", "理化", "生物", "physics", "chemistry", "biology"], sampleObjectives: ["能根據觀察提出可檢驗的假說", "能設計並評估探究流程", "能依資料推論並說明限制"] },
  { domain: "社會", prefix: "社", aliases: ["社會科", "歷史", "地理", "公民", "social", "history", "geography"], sampleObjectives: ["能從多元史料推論並評估觀點", "能分析社會議題的成因與影響", "能提出兼顧多方的解決方案"] },
  { domain: "藝術", prefix: "藝", aliases: ["art", "音樂", "美術", "視覺藝術", "表演藝術"], sampleObjectives: ["能運用多元媒材進行創作", "能欣賞並分析作品的美感形式", "能連結藝術與文化脈絡"] },
  { domain: "健康與體育", prefix: "健體", aliases: ["健體", "體育", "健康", "pe", "physical education"], sampleObjectives: ["能建立健康生活習慣", "能運用運動技能解決問題", "能展現團隊合作與運動精神"] },
  { domain: "綜合活動", prefix: "綜", aliases: ["綜合", "綜活", "童軍", "家政", "輔導"], sampleObjectives: ["能自主規劃並執行活動", "能反思個人成長", "能展現人際協作"] },
  { domain: "科技", prefix: "科技", aliases: ["資訊", "生活科技", "資訊科技", "tech", "technology", "computer", "coding"], sampleObjectives: ["能運用計算思維解決問題", "能負責任地使用科技資源", "能評估科技對社會的影響"] },
];

let cachedDataset: string | undefined;
function loadDataset(): string {
  if (cachedDataset !== undefined) return cachedDataset;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "data", "108-core-competencies.md"),
    path.join(here, "data", "108-core-competencies.md"),
  ];
  for (const file of candidates) {
    try {
      cachedDataset = readFileSync(file, "utf8");
      return cachedDataset;
    } catch {
      /* try next */
    }
  }
  cachedDataset = "";
  return cachedDataset;
}

function stageFor(gradeLevel: string): "E" | "J" | "U" {
  if (/高中|高職|十[一二]|1[0-2]|U/.test(gradeLevel)) return "U";
  if (/國中|七|八|九|[789]年級|J/.test(gradeLevel)) return "J";
  return "E"; // 國小 / default
}

function findDomain(query: string): DomainSeed | undefined {
  const q = query.toLowerCase();
  return DOMAIN_SEEDS.find(
    (d) => d.domain === query || query.includes(d.domain) || d.aliases.some((a) => q.includes(a.toLowerCase())),
  );
}

/** Parse competency `| code | description |` rows for a given code prefix+stage. */
function competenciesFor(prefix: string, stage: string): string[] {
  const md = loadDataset();
  if (!md) return [];
  const re = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm;
  const needle = `${prefix}-${stage}-`;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const code = m[1].replace(/【[^】]*】/g, "").trim();
    const desc = m[2].trim();
    if (!code.startsWith(needle) || !desc || desc === "完整說明") continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(`${code}：${desc}`);
  }
  return out;
}

export interface AlignmentInput {
  gradeLevel: string;
  domain: string;
  topic?: string;
}

/**
 * Produce a CurriculumAlignment for a grade + domain, with REAL 108 課綱 core
 * competency codes parsed from the bundled dataset (generic fallback otherwise).
 */
export function alignCurriculum(input: AlignmentInput): CurriculumAlignment {
  const seed = findDomain(input.domain);
  const stage = stageFor(input.gradeLevel);
  const competencies = seed ? competenciesFor(seed.prefix, stage) : [];
  return {
    framework: "108課綱",
    gradeLevel: input.gradeLevel,
    domain: seed?.domain ?? input.domain,
    learningObjectives: seed?.sampleObjectives ?? [],
    coreCompetencies: competencies.length
      ? competencies
      : ["系統思考與解決問題", "符號運用與溝通表達"],
    bloomFocus: ["apply", "analyze", "evaluate"],
  };
}

export function listCurriculumDomains(): string[] {
  return DOMAIN_SEEDS.map((d) => d.domain);
}
