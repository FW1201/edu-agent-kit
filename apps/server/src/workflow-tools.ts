import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import { Quiz, Lesson, Board } from "@edu-agent-kit/core";
import { createAiBoardAndWait, addPost } from "@edu-agent-kit/padlet";
import { buildKahootWorkbook } from "@edu-agent-kit/kahoot";
import { buildWaygroundWorkbook } from "@edu-agent-kit/wayground";
import { buildWordwallContent } from "@edu-agent-kit/wordwall";
import { buildNearpodPptx } from "@edu-agent-kit/nearpod";
import { createCoursework } from "@edu-agent-kit/google-classroom";

function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) ||
    "activity"
  );
}

const ClassroomSpec = z
  .object({
    courseId: z.string().min(1).describe("Google Classroom course id."),
    title: z.string().optional(),
    description: z.string().optional(),
    createAssignment: z.boolean().default(true),
  })
  .strict();

const WorkflowInput = z
  .object({
    platform: z.enum(["padlet", "kahoot", "wayground", "wordwall", "nearpod"]),
    content: z
      .unknown()
      .describe(
        "The content object: a Board for padlet, a Lesson for nearpod, a Quiz for kahoot/wayground/wordwall.",
      ),
    outputPath: z.string().optional().describe("Output path for file-producing platforms."),
    padletRole: z.string().default("teacher").describe("Requester role for Padlet AI-board creation."),
    wordwallTemplate: z
      .enum(["quiz", "match_up", "anagram", "group_sort", "open_box_or_wheel"])
      .default("quiz"),
    classroom: ClassroomSpec.optional().describe(
      "Optionally distribute via Google Classroom after producing the artifact.",
    ),
  })
  .strict();

interface Artifact {
  kind: "url" | "file";
  url?: string;
  files?: string[];
  summary: string;
  warnings: string[];
}

async function produceArtifact(
  args: z.infer<typeof WorkflowInput>,
): Promise<Artifact> {
  const out = (ext: string, title: string): string =>
    args.outputPath ?? path.join(process.cwd(), "out", `${slugify(title)}.${ext}`);

  if (args.platform === "padlet") {
    const board = Board.parse(args.content);
    const prompt = `Create a collaborative board titled "${board.title}". ${
      board.description ?? ""
    } Organize it into these sections: ${board.sections.join(", ") || "(your choice)"}.`.slice(
      0,
      2000,
    );
    const created = await createAiBoardAndWait({ prompt, role: args.padletRole });
    const warnings: string[] = [];
    for (const post of board.seedPosts) {
      try {
        // Section labels are not Padlet section ids; omit to avoid 422s.
        await addPost(created.boardId, { ...post, section: undefined });
      } catch (err) {
        warnings.push(`Failed to add a seed post: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return {
      kind: "url",
      url: created.url,
      summary: `Padlet board created${created.url ? ` at ${created.url}` : ""} with ${board.seedPosts.length} seed post(s).`,
      warnings,
    };
  }

  if (args.platform === "nearpod") {
    const lesson = Lesson.parse(args.content);
    const res = await buildNearpodPptx(lesson, out("pptx", lesson.title));
    return {
      kind: "file",
      files: [res.path],
      summary: `Nearpod slides export (${res.slideCount} slides): ${res.path}`,
      warnings: [],
    };
  }

  // Quiz-based platforms.
  const quiz = Quiz.parse(args.content);
  if (args.platform === "kahoot") {
    const res = await buildKahootWorkbook(quiz, out("xlsx", quiz.title));
    return { kind: "file", files: [res.path], summary: `Kahoot import workbook: ${res.path}`, warnings: res.warnings };
  }
  if (args.platform === "wayground") {
    const res = await buildWaygroundWorkbook(quiz, out("xlsx", quiz.title));
    return { kind: "file", files: [res.path], summary: `Wayground import spreadsheet: ${res.path}`, warnings: res.warnings };
  }
  // wordwall
  const content = buildWordwallContent({ quiz }, args.wordwallTemplate);
  const base = args.outputPath ?? path.join(process.cwd(), "out", slugify(quiz.title));
  const csvPath = base.endsWith(".csv") ? base : `${base}.csv`;
  const txtPath = csvPath.replace(/\.csv$/, ".txt");
  await fs.mkdir(path.dirname(csvPath), { recursive: true });
  await fs.writeFile(csvPath, content.csv, "utf8");
  await fs.writeFile(txtPath, content.txt, "utf8");
  return {
    kind: "file",
    files: [csvPath, txtPath],
    summary: `Wordwall content (${args.wordwallTemplate}): ${csvPath}, ${txtPath}`,
    warnings: content.warnings,
  };
}

export const generateAndDistributeTool = defineTool({
  name: "workflow_generate_and_distribute",
  title: "Generate & Distribute (end-to-end)",
  description: `End-to-end: take already-generated content, produce the platform artifact, and optionally create a Google Classroom assignment for it.

Args:
  - platform: 'padlet' | 'kahoot' | 'wayground' | 'wordwall' | 'nearpod'.
  - content: the matching object — Board (padlet), Lesson (nearpod), Quiz (kahoot/wayground/wordwall). Get these from content_generate_*.
  - outputPath?: destination for file-producing platforms.
  - padletRole?: requester role for Padlet AI boards (default 'teacher').
  - wordwallTemplate?: template for wordwall (default 'quiz').
  - classroom?: { courseId, title?, description?, createAssignment? } — distribute after producing the artifact.

Behavior:
  - Padlet produces a live board URL (full automation). Other platforms produce an import/export FILE you upload in one step.
  - If 'classroom' is set: padlet board URLs are attached as a link assignment; for file-based platforms a Classroom assignment is created with instructions (attach the activity after you upload it).

Returns (structuredContent): { platform, artifact: {kind, url?, files?}, classroom?: {courseWorkId, alternateLink}, warnings[] }.`,
  inputSchema: WorkflowInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    let artifact: Artifact;
    try {
      artifact = await produceArtifact(args);
    } catch (err) {
      return errorResult(handleApiError(err, "Workflow"));
    }

    const result: Record<string, unknown> = {
      platform: args.platform,
      artifact: { kind: artifact.kind, url: artifact.url, files: artifact.files },
      warnings: artifact.warnings,
    };
    const lines = [`# Workflow complete: ${args.platform}`, ``, artifact.summary];

    if (args.classroom && args.classroom.createAssignment) {
      try {
        const c = args.classroom;
        const title = c.title ?? `Activity (${args.platform})`;
        const description =
          c.description ??
          (artifact.kind === "url"
            ? `Open the activity: ${artifact.url}`
            : `Activity files generated locally: ${artifact.files?.join(", ")}. Upload/import them to ${args.platform}, then attach the resulting link here.`);
        const cw = await createCoursework(c.courseId, {
          title,
          description,
          materials:
            artifact.kind === "url" && artifact.url
              ? [{ link: { url: artifact.url, title } }]
              : undefined,
        });
        result.classroom = { courseWorkId: cw.id, alternateLink: cw.alternateLink };
        lines.push(
          ``,
          `## Google Classroom`,
          `Assignment created: ${cw.alternateLink ?? cw.id}`,
        );
      } catch (err) {
        lines.push(``, `## Google Classroom`, `⚠️ ${handleApiError(err, "Google Classroom")}`);
        result.classroomError = handleApiError(err, "Google Classroom");
      }
    }

    if (artifact.warnings.length) {
      lines.push(``, `## Warnings`, ...artifact.warnings.map((w) => `- ${w}`));
    }
    return dualResult(lines.join("\n"), result);
  },
});

export const workflowTools: ToolDefinition[] = [
  generateAndDistributeTool,
] as unknown as ToolDefinition[];
