import { z } from "zod";
import {
  defineTool,
  dualResult,
  errorResult,
  textResult,
  imageResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import {
  buildQuizBrief,
  buildLessonBrief,
  buildBoardBrief,
  validateQuiz,
  validateLesson,
  validateBoard,
  scoreDepth,
  SourceMaterial,
} from "@edu-agent-kit/core";
import { ingestFile, ingestUrl, ingestFolder, loadImage, alignCurriculum } from "@edu-agent-kit/sources";

function parseSources(input: unknown): SourceMaterial[] {
  const parsed = z.array(SourceMaterial).safeParse(input ?? []);
  return parsed.success ? parsed.data : [];
}

// ---------------------------------------------------------------------------
// Ingestion / research / alignment
// ---------------------------------------------------------------------------

const IngestInput = z
  .object({
    path: z.string().optional().describe("Local file path (.pdf/.docx/.txt/.md/.csv/.json)."),
    url: z.string().url().optional().describe("Public URL to fetch and extract."),
  })
  .strict();

export const ingestSourceTool = defineTool({
  name: "content_ingest_source",
  title: "Ingest External Source",
  description: `Parse a local file or a URL into a structured SourceMaterial for use as generation context (the "external resource accommodation" layer).

Args:
  - path (string, optional): a local file (.pdf/.docx/.txt/.md/.csv/.json).
  - url (string, optional): a public URL whose readable content is extracted.
Provide exactly one.

Returns (structuredContent): a SourceMaterial { id, origin, title?, text, citations[], retrievedAt }. Pass it (in an array) to content_generate_* as 'sources'.`,
  inputSchema: IngestInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    if (!args.path && !args.url) return errorResult("Provide either 'path' or 'url'.");
    try {
      const material = args.path ? await ingestFile(args.path) : await ingestUrl(args.url!);
      const preview = material.text.slice(0, 600);
      return dualResult(
        `# Ingested: ${material.title ?? material.id}\n\n- **Origin:** ${material.origin}\n- **Chars:** ${material.text.length}\n\n## Preview\n${preview}…`,
        material,
      );
    } catch (err) {
      return errorResult(handleApiError(err, "Sources"));
    }
  },
});

const IngestImageInput = z
  .object({
    path: z.string().min(1).describe("Local image file (.png/.jpg/.jpeg/.gif/.webp)."),
  })
  .strict();

export const ingestImageTool = defineTool({
  name: "content_ingest_image",
  title: "Ingest an Image (handwriting / 講義照片)",
  description: `Load an image (講義照片, 手寫稿, 黑板) and hand it to YOU (the agent) to transcribe/summarize with your built-in vision — no external OCR API needed. Best for handwriting.

Args: path (string) — a local image file.
Returns: an image content block + an instruction. After you read it, organize the transcription into the knowledge base (or pass as a source to content_generate_*).`,
  inputSchema: IngestImageInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (args) => {
    try {
      const img = await loadImage(args.path);
      return imageResult(
        img.base64,
        img.mimeType,
        `以下是圖片「${img.title}」。請用你的視覺能力把內容（含手寫）轉寫成文字，必要時摘要重點，整理成可加入知識庫或作為生成素材的內容。`,
        { title: img.title, mimeType: img.mimeType, locator: args.path },
      );
    } catch (err) {
      return errorResult(handleApiError(err, "Sources"));
    }
  },
});

const IngestFolderInput = z
  .object({
    dir: z.string().min(1).describe("Local folder to batch-ingest."),
    recursive: z.boolean().default(false).describe("Walk subfolders too."),
  })
  .strict();

export const ingestFolderTool = defineTool({
  name: "content_ingest_folder",
  title: "Ingest a Folder (batch)",
  description: `Batch-ingest every supported file (.pdf/.docx/.txt/.md/.csv/.json) in a local folder into SourceMaterial[]. Unsupported types are skipped; per-file failures are reported, not fatal.

Args: dir (string), recursive (boolean, default false).
Returns (structuredContent): { count, sources: SourceMaterial[], errors: [{file,error}] }. Pass 'sources' to content_generate_*.`,
  inputSchema: IngestFolderInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    try {
      const res = await ingestFolder(args.dir, { recursive: args.recursive });
      const md = [
        `# Ingested folder: ${args.dir}`,
        `- Files ingested: ${res.materials.length}`,
        res.errors.length ? `- Skipped/failed: ${res.errors.length}` : ``,
      ].filter(Boolean).join("\n");
      return dualResult(md, { count: res.materials.length, sources: res.materials, errors: res.errors });
    } catch (err) {
      return errorResult(handleApiError(err, "Sources"));
    }
  },
});

const AlignInput = z
  .object({
    gradeLevel: z.string().min(1).describe("Grade level/band, e.g. '國中一年級'."),
    domain: z.string().min(1).describe("Subject domain, e.g. '數學', 'english'."),
    topic: z.string().optional(),
  })
  .strict();

export const alignCurriculumTool = defineTool({
  name: "content_align_curriculum",
  title: "Align to Curriculum (108課綱)",
  description: `Produce a CurriculumAlignment scaffold (108課綱 core competencies + sample objectives) for a grade + domain. Attach the result to generated content's 'alignment'.

Args:
  - gradeLevel (string), domain (string), topic (string, optional).

Returns (structuredContent): a CurriculumAlignment { framework, gradeLevel, domain, coreCompetencies[], learningObjectives[], bloomFocus[] }.`,
  inputSchema: AlignInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (args) => {
    const alignment = alignCurriculum(args);
    return dualResult(
      `# Curriculum alignment: ${alignment.domain} (${alignment.gradeLevel})\n\n**Core competencies:**\n${alignment.coreCompetencies.map((c) => `- ${c}`).join("\n")}\n\n**Sample objectives:**\n${alignment.learningObjectives.map((c) => `- ${c}`).join("\n")}`,
      alignment,
    );
  },
});

// ---------------------------------------------------------------------------
// Generation (brief-or-validate)
// ---------------------------------------------------------------------------

const GenQuizInput = z
  .object({
    topic: z.string().min(1),
    questionCount: z.number().int().min(1).max(50).default(10),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
    language: z.string().default("zh-TW"),
    questionTypes: z.array(z.string()).optional(),
    sources: z.unknown().optional().describe("SourceMaterial[] from ingest/research."),
    draftQuestions: z
      .unknown()
      .optional()
      .describe("Question[] you authored from the brief. Provide to validate/normalize/score."),
    alignment: z.unknown().optional(),
  })
  .strict();

export const generateQuizTool = defineTool({
  name: "content_generate_quiz",
  title: "Generate Quiz (deep)",
  description: `Two-step deep quiz generation. WITHOUT 'draftQuestions', returns a generation BRIEF (required Bloom distribution + depth rules + source digest) for you to author from. WITH 'draftQuestions', validates and normalizes them into a canonical Quiz and scores pedagogical depth, returning actionable warnings.

Args:
  - topic, questionCount (default 10), gradeLevel?, subject?, language (default zh-TW), questionTypes?[]
  - sources?: SourceMaterial[] (from content_ingest_source, or web-search results your agent already gathered, mapped to the SourceMaterial shape)
  - draftQuestions?: Question[] (author these from the brief, then call again)
  - alignment?: CurriculumAlignment

Returns: a brief (text) on step 1; on step 2 structuredContent { quiz, depth, warnings }. The returned 'quiz' is what you pass to platform/workflow tools.`,
  inputSchema: GenQuizInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (args) => {
    const sources = parseSources(args.sources);
    if (args.draftQuestions === undefined) {
      return textResult(
        buildQuizBrief(
          {
            topic: args.topic,
            questionCount: args.questionCount,
            gradeLevel: args.gradeLevel,
            subject: args.subject,
            language: args.language,
            questionTypes: args.questionTypes,
          },
          sources,
        ),
      );
    }
    const quizDraft = {
      title: args.topic,
      subject: args.subject,
      gradeLevel: args.gradeLevel,
      language: args.language,
      questions: args.draftQuestions,
      alignment: args.alignment,
      sources,
    };
    const result = validateQuiz(quizDraft);
    if (!result.valid || !result.value) {
      return errorResult(`Invalid draftQuestions:\n${result.errors.join("\n")}`);
    }
    const depth = scoreDepth(result.value);
    const warnings = [...result.warnings, ...depth.warnings];
    const md = [
      `# Quiz "${result.value.title}" validated`,
      ``,
      `- **Questions:** ${result.value.questions.length}`,
      `- **Depth score:** ${depth.score}/100 (higher-order ${(depth.higherOrderRatio * 100).toFixed(0)}%)`,
      warnings.length ? `\n## Warnings\n${warnings.map((w) => `- ${w}`).join("\n")}` : `\n✅ No warnings.`,
    ].join("\n");
    return dualResult(md, { quiz: result.value, depth, warnings });
  },
});

const GenLessonInput = z
  .object({
    topic: z.string().min(1),
    slideCount: z.number().int().min(1).max(60).default(10),
    gradeLevel: z.string().optional(),
    language: z.string().default("zh-TW"),
    sources: z.unknown().optional(),
    draftSlides: z.unknown().optional(),
    objectives: z.array(z.string()).optional(),
    alignment: z.unknown().optional(),
  })
  .strict();

export const generateLessonTool = defineTool({
  name: "content_generate_lesson",
  title: "Generate Lesson (deep)",
  description: `Two-step interactive-lesson generation. WITHOUT 'draftSlides', returns a generation brief. WITH 'draftSlides', validates/normalizes into a canonical Lesson and warns if it lacks active-learning checkpoints or objectives.

Args: topic, slideCount (default 10), gradeLevel?, language (zh-TW), objectives?[], sources?, draftSlides? (Slide[]), alignment?.
Returns: brief (text) on step 1; structuredContent { lesson, warnings } on step 2. Pass 'lesson' to nearpod/workflow tools.`,
  inputSchema: GenLessonInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (args) => {
    const sources = parseSources(args.sources);
    if (args.draftSlides === undefined) {
      return textResult(
        buildLessonBrief(
          { topic: args.topic, slideCount: args.slideCount, gradeLevel: args.gradeLevel, language: args.language },
          sources,
        ),
      );
    }
    const draft = {
      title: args.topic,
      gradeLevel: args.gradeLevel,
      language: args.language,
      objectives: args.objectives ?? [],
      slides: args.draftSlides,
      alignment: args.alignment,
      sources,
    };
    const result = validateLesson(draft);
    if (!result.valid || !result.value) {
      return errorResult(`Invalid draftSlides:\n${result.errors.join("\n")}`);
    }
    const md = [
      `# Lesson "${result.value.title}" validated`,
      `- **Slides:** ${result.value.slides.length}`,
      result.warnings.length ? `\n## Warnings\n${result.warnings.map((w) => `- ${w}`).join("\n")}` : `\n✅ No warnings.`,
    ].join("\n");
    return dualResult(md, { lesson: result.value, warnings: result.warnings });
  },
});

const GenBoardInput = z
  .object({
    topic: z.string().min(1),
    seedPostCount: z.number().int().min(0).max(50).default(6),
    language: z.string().default("zh-TW"),
    sources: z.unknown().optional(),
    draftBoard: z.unknown().optional(),
  })
  .strict();

export const generateBoardTool = defineTool({
  name: "content_generate_board",
  title: "Generate Collaborative Board (deep)",
  description: `Two-step board generation. WITHOUT 'draftBoard', returns a generation brief. WITH 'draftBoard', validates/normalizes into a canonical Board and warns if it has no seed posts.

Args: topic, seedPostCount (default 6), language (zh-TW), sources?, draftBoard? (Board).
Returns: brief (text) on step 1; structuredContent { board, warnings } on step 2. Pass 'board' to padlet/workflow tools.`,
  inputSchema: GenBoardInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (args) => {
    const sources = parseSources(args.sources);
    if (args.draftBoard === undefined) {
      return textResult(
        buildBoardBrief({ topic: args.topic, seedPostCount: args.seedPostCount, language: args.language }, sources),
      );
    }
    const result = validateBoard(args.draftBoard);
    if (!result.valid || !result.value) {
      return errorResult(`Invalid draftBoard:\n${result.errors.join("\n")}`);
    }
    const md = [
      `# Board "${result.value.title}" validated`,
      `- **Sections:** ${result.value.sections.length}`,
      `- **Seed posts:** ${result.value.seedPosts.length}`,
      result.warnings.length ? `\n## Warnings\n${result.warnings.map((w) => `- ${w}`).join("\n")}` : `\n✅ No warnings.`,
    ].join("\n");
    return dualResult(md, { board: result.value, warnings: result.warnings });
  },
});

export const contentTools: ToolDefinition[] = [
  ingestSourceTool,
  ingestImageTool,
  ingestFolderTool,
  alignCurriculumTool,
  generateQuizTool,
  generateLessonTool,
  generateBoardTool,
] as unknown as ToolDefinition[];
