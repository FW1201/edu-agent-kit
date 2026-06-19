import type { CurriculumAlignment } from "@edu-agent-kit/core";

/**
 * Seed dataset of Taiwan 108 課綱 領域 core competencies (核心素養).
 * This is a representative seed — extend per domain/grade as needed. The goal
 * is to scaffold alignment, not to be an exhaustive standards database.
 */
interface DomainSeed {
  domain: string;
  aliases: string[];
  coreCompetencies: string[];
  sampleObjectives: string[];
}

const DOMAIN_SEEDS: DomainSeed[] = [
  {
    domain: "國語文",
    aliases: ["國語", "語文", "chinese", "國文"],
    coreCompetencies: [
      "系統思考與解決問題：運用語文進行分析、推論與判斷",
      "符號運用與溝通表達：精確理解與表達文本意義",
      "藝術涵養與美感素養：欣賞文學作品的語言之美",
    ],
    sampleObjectives: [
      "能分析文本的結構與寫作手法",
      "能比較不同文本觀點並提出評價",
      "能依情境調整語言表達策略",
    ],
  },
  {
    domain: "數學",
    aliases: ["math", "mathematics", "算數"],
    coreCompetencies: [
      "系統思考與解決問題：運用數學概念與程序解決問題",
      "符號運用與溝通表達：以數學語言溝通推理過程",
      "規劃執行與創新應變：選擇合宜策略並檢核結果",
    ],
    sampleObjectives: [
      "能將真實情境轉化為數學模型",
      "能說明解題策略並驗證合理性",
      "能比較多種解法的效率與適用性",
    ],
  },
  {
    domain: "自然科學",
    aliases: ["自然", "science", "理化", "生物", "physics", "chemistry", "biology"],
    coreCompetencies: [
      "系統思考與解決問題：依證據進行科學論證",
      "科技資訊與媒體素養：蒐集與評估科學資訊",
      "道德實踐與公民意識：思辨科學與社會議題",
    ],
    sampleObjectives: [
      "能根據觀察提出可檢驗的假說",
      "能設計並評估探究流程",
      "能依資料推論並提出結論與限制",
    ],
  },
  {
    domain: "社會",
    aliases: ["社會科", "歷史", "地理", "公民", "social studies", "history", "geography"],
    coreCompetencies: [
      "道德實踐與公民意識：關注社會議題並參與公共事務",
      "多元文化與國際理解：理解不同文化與觀點",
      "系統思考與解決問題：分析社會現象的因果與脈絡",
    ],
    sampleObjectives: [
      "能從多元史料推論並評估觀點",
      "能分析社會議題的成因與影響",
      "能提出兼顧多方利益的解決方案",
    ],
  },
  {
    domain: "英語文",
    aliases: ["英語", "english", "英文", "efl", "esl"],
    coreCompetencies: [
      "符號運用與溝通表達：以英語進行有效溝通",
      "多元文化與國際理解：理解跨文化情境",
      "科技資訊與媒體素養：運用資源自主學習語言",
    ],
    sampleObjectives: [
      "能理解並摘要主旨與細節",
      "能依情境進行口語與書面表達",
      "能比較中英文化差異並適切回應",
    ],
  },
];

function findDomain(query: string): DomainSeed | undefined {
  const q = query.toLowerCase();
  return DOMAIN_SEEDS.find(
    (d) =>
      d.domain === query ||
      d.aliases.some((a) => q.includes(a.toLowerCase())) ||
      query.includes(d.domain),
  );
}

export interface AlignmentInput {
  gradeLevel: string;
  domain: string;
  topic?: string;
}

/**
 * Produce a CurriculumAlignment scaffold for a grade + domain, seeded with
 * 108 課綱 core competencies and sample objectives. Returns a best-effort match;
 * unknown domains still yield a usable, generic alignment object.
 */
export function alignCurriculum(input: AlignmentInput): CurriculumAlignment {
  const seed = findDomain(input.domain);
  return {
    framework: "108課綱",
    gradeLevel: input.gradeLevel,
    domain: seed?.domain ?? input.domain,
    learningObjectives: seed?.sampleObjectives ?? [],
    coreCompetencies: seed?.coreCompetencies ?? [
      "系統思考與解決問題",
      "符號運用與溝通表達",
    ],
    bloomFocus: ["apply", "analyze", "evaluate"],
  };
}

/** List the domains covered by the seed dataset. */
export function listCurriculumDomains(): string[] {
  return DOMAIN_SEEDS.map((d) => d.domain);
}
