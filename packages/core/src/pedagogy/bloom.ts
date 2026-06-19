import type { BloomLevel } from "../models/common.js";
import type { Quiz } from "../models/quiz.js";

const ALL_LEVELS: BloomLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

const HIGHER_ORDER: ReadonlySet<BloomLevel> = new Set<BloomLevel>([
  "apply",
  "analyze",
  "evaluate",
  "create",
]);

/**
 * Recommend a Bloom-level distribution for a quiz of `count` questions.
 * Deliberately weights toward higher-order thinking to counter the shallow
 * remember/understand bias of native platform AI generators.
 *
 * Returns a map of level -> number of questions, summing to `count`.
 */
export function recommendBloomDistribution(
  count: number,
): Record<BloomLevel, number> {
  // Target weights (sum = 1.0). Skews higher-order while keeping a base.
  const weights: Record<BloomLevel, number> = {
    remember: 0.15,
    understand: 0.2,
    apply: 0.25,
    analyze: 0.2,
    evaluate: 0.1,
    create: 0.1,
  };

  const dist = {} as Record<BloomLevel, number>;
  let assigned = 0;
  for (const level of ALL_LEVELS) {
    const n = Math.floor(count * weights[level]);
    dist[level] = n;
    assigned += n;
  }
  // Distribute any remainder to higher-order levels first.
  const remainderOrder: BloomLevel[] = [
    "apply",
    "analyze",
    "understand",
    "evaluate",
    "create",
    "remember",
  ];
  let i = 0;
  while (assigned < count) {
    dist[remainderOrder[i % remainderOrder.length]] += 1;
    assigned += 1;
    i += 1;
  }
  return dist;
}

export interface DepthReport {
  /** 0-100 depth score. */
  score: number;
  higherOrderRatio: number;
  withExplanation: number;
  withRubricOnOpenEnded: number;
  warnings: string[];
}

/**
 * Score the pedagogical depth of a generated quiz. Used by the generation
 * tools to give the calling agent actionable feedback when output is shallow.
 */
export function scoreDepth(quiz: Quiz): DepthReport {
  const total = quiz.questions.length;
  const warnings: string[] = [];
  if (total === 0) {
    return {
      score: 0,
      higherOrderRatio: 0,
      withExplanation: 0,
      withRubricOnOpenEnded: 0,
      warnings: ["Quiz has no questions."],
    };
  }

  const higherOrder = quiz.questions.filter(
    (q) => q.bloomLevel && HIGHER_ORDER.has(q.bloomLevel),
  ).length;
  const withExplanation = quiz.questions.filter(
    (q) => (q.explanation ?? "").trim().length > 0,
  ).length;
  const openEnded = quiz.questions.filter(
    (q) => q.type === "open_ended" || q.type === "short_answer",
  );
  const withRubric = openEnded.filter((q) => q.rubric.length > 0).length;

  const higherOrderRatio = higherOrder / total;
  const explanationRatio = withExplanation / total;
  const rubricRatio = openEnded.length === 0 ? 1 : withRubric / openEnded.length;

  // Weighted composite score.
  const score = Math.round(
    100 * (0.45 * higherOrderRatio + 0.35 * explanationRatio + 0.2 * rubricRatio),
  );

  if (higherOrderRatio < 0.4) {
    warnings.push(
      `Only ${(higherOrderRatio * 100).toFixed(0)}% of questions are higher-order (apply/analyze/evaluate/create). Aim for >=40%. Consider regenerating shallow remember/understand items.`,
    );
  }
  if (explanationRatio < 0.8) {
    warnings.push(
      `Only ${withExplanation}/${total} questions include an explanation. Add worked explanations for depth.`,
    );
  }
  if (openEnded.length > 0 && rubricRatio < 1) {
    warnings.push(
      `${openEnded.length - withRubric} open-ended/short-answer question(s) lack a grading rubric.`,
    );
  }
  return {
    score,
    higherOrderRatio,
    withExplanation,
    withRubricOnOpenEnded: withRubric,
    warnings,
  };
}

export { ALL_LEVELS as bloomLevels, HIGHER_ORDER as higherOrderLevels };
