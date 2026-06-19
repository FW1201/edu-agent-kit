import type { BloomLevel } from "../models/common.js";
import type { SourceMaterial } from "../models/source.js";
import { recommendBloomDistribution } from "./bloom.js";

export interface QuizBriefParams {
  topic: string;
  questionCount: number;
  gradeLevel?: string;
  subject?: string;
  language?: string;
  questionTypes?: string[];
}

function sourceDigest(sources: SourceMaterial[], maxChars = 6000): string {
  if (sources.length === 0) return "(no external sources provided)";
  let out = "";
  for (const s of sources) {
    const header = `\n### Source: ${s.title ?? s.id} (${s.origin})\n`;
    const remaining = maxChars - out.length - header.length;
    if (remaining <= 0) break;
    out += header + s.text.slice(0, Math.max(0, remaining));
  }
  return out.trim();
}

/**
 * Build a generation brief instructing the calling agent how to produce a
 * DEEP quiz. The MCP server has no LLM of its own — these scaffolds let the
 * client agent generate, then submit a draft back for validation/normalization.
 */
export function buildQuizBrief(
  params: QuizBriefParams,
  sources: SourceMaterial[],
): string {
  const dist = recommendBloomDistribution(params.questionCount);
  const distLines = (Object.entries(dist) as [BloomLevel, number][])
    .filter(([, n]) => n > 0)
    .map(([level, n]) => `  - ${level}: ${n} question(s)`)
    .join("\n");

  return [
    `# Quiz Generation Brief`,
    ``,
    `Topic: ${params.topic}`,
    `Questions: ${params.questionCount}`,
    params.gradeLevel ? `Grade level: ${params.gradeLevel}` : null,
    params.subject ? `Subject: ${params.subject}` : null,
    `Language: ${params.language ?? "zh-TW"}`,
    params.questionTypes?.length
      ? `Allowed question types: ${params.questionTypes.join(", ")}`
      : null,
    ``,
    `## Required Bloom distribution (counter shallow output)`,
    distLines,
    ``,
    `## Depth requirements (these distinguish this from native platform AI)`,
    `1. Every question MUST set a \`bloomLevel\`.`,
    `2. Every question MUST include a worked \`explanation\`.`,
    `3. For multiple_choice/multiple_select, each distractor SHOULD include a \`rationale\` naming the misconception it targets.`,
    `4. Every open_ended/short_answer question MUST include a \`rubric\`.`,
    `5. Ground content in the provided sources where available; add \`tags\`.`,
    ``,
    `## Source material`,
    sourceDigest(sources),
    ``,
    `## Next step`,
    `Produce the questions as an array conforming to the Question schema, then call \`content_generate_quiz\` again with \`draftQuestions\` set. The tool will validate, normalize, and score the depth of your draft and return actionable warnings.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export interface LessonBriefParams {
  topic: string;
  slideCount: number;
  gradeLevel?: string;
  language?: string;
}

export function buildLessonBrief(
  params: LessonBriefParams,
  sources: SourceMaterial[],
): string {
  return [
    `# Lesson Generation Brief`,
    ``,
    `Topic: ${params.topic}`,
    `Target slides: ${params.slideCount}`,
    params.gradeLevel ? `Grade level: ${params.gradeLevel}` : null,
    `Language: ${params.language ?? "zh-TW"}`,
    ``,
    `## Structure requirements`,
    `1. Open with explicit learning \`objectives\`.`,
    `2. Alternate content slides with at least one \`activity\` or \`assessment\` slide every 3-4 slides (active learning).`,
    `3. Embed formative-assessment questions (\`embeddedQuestion\`) on assessment slides — include explanations.`,
    `4. Add \`speakerNotes\` to content slides.`,
    `5. Ground content in provided sources.`,
    ``,
    `## Source material`,
    sourceDigest(sources),
    ``,
    `## Next step`,
    `Produce a slides array conforming to the Slide schema, then call \`content_generate_lesson\` again with \`draftSlides\` set for validation and normalization.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export interface BoardBriefParams {
  topic: string;
  seedPostCount: number;
  language?: string;
}

export function buildBoardBrief(
  params: BoardBriefParams,
  sources: SourceMaterial[],
): string {
  return [
    `# Board Generation Brief`,
    ``,
    `Topic: ${params.topic}`,
    `Seed posts: ${params.seedPostCount}`,
    `Language: ${params.language ?? "zh-TW"}`,
    ``,
    `## Requirements`,
    `1. Propose 3-5 \`sections\` (columns) that scaffold inquiry, not just "topic / questions".`,
    `2. Seed each section with starter posts that model the expected depth of student contributions.`,
    `3. Include at least one prompt post per section that asks a higher-order question.`,
    `4. Ground examples in provided sources.`,
    ``,
    `## Source material`,
    sourceDigest(sources),
    ``,
    `## Next step`,
    `Produce sections + seedPosts conforming to the Board schema, then call \`content_generate_board\` again with \`draftBoard\` set for validation.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
