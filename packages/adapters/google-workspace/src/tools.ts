import { z } from "zod";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import { Lesson, Quiz } from "@edu-agent-kit/core";
import {
  buildDocRequests,
  docInputFromLesson,
  buildSlideRequests,
  buildFormRequests,
  buildSheetGrid,
  sheetGridFromQuiz,
} from "./builders.js";
import path from "node:path";
import {
  createDoc,
  createSlides,
  createForm,
  createSheet,
  driveCreateFolder,
  driveUploadFile,
  driveSetSharing,
  driveListFolder,
  driveDownloadFile,
  readForm,
} from "./api.js";

const lessonError = (e: z.ZodError): string =>
  `Invalid lesson: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;
const quizError = (e: z.ZodError): string =>
  `Invalid quiz: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`;

export const docsFromLessonTool = defineTool({
  name: "google_docs_create_from_lesson",
  title: "Create Google Doc from Lesson",
  description: `Create a Google Doc (講義) from a Lesson: title + 學習目標 + one heading/section per slide.

Args: lesson (a core Lesson object).
Returns (structuredContent): { id, url }. Requires Google authorization (documents scope).`,
  inputSchema: z.object({ lesson: z.unknown() }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    const parsed = Lesson.safeParse(args.lesson);
    if (!parsed.success) return errorResult(lessonError(parsed.error));
    try {
      const input = docInputFromLesson(parsed.data);
      const res = await createDoc(input.title, buildDocRequests(input));
      return dualResult(`# Google Doc created\n\n${res.url}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Docs"));
    }
  },
});

export const docsCreateTool = defineTool({
  name: "google_docs_create",
  title: "Create Google Doc",
  description: `Create a Google Doc from a title and structured sections.

Args:
  - title (string)
  - sections: array of { heading?, body?, bullets?[] }
Returns (structuredContent): { id, url }.`,
  inputSchema: z
    .object({
      title: z.string().min(1),
      sections: z
        .array(
          z.object({
            heading: z.string().optional(),
            body: z.string().optional(),
            bullets: z.array(z.string()).optional(),
          }),
        )
        .default([]),
    })
    .strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    try {
      const res = await createDoc(args.title, buildDocRequests({ title: args.title, sections: args.sections }));
      return dualResult(`# Google Doc created\n\n${res.url}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Docs"));
    }
  },
});

export const slidesFromLessonTool = defineTool({
  name: "google_slides_create_from_lesson",
  title: "Create Google Slides from Lesson",
  description: `Create a Google Slides presentation from a Lesson (one TITLE_AND_BODY slide per lesson slide).

Args: lesson (a core Lesson object).
Returns (structuredContent): { id, url }. Requires presentations scope.`,
  inputSchema: z.object({ lesson: z.unknown() }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    const parsed = Lesson.safeParse(args.lesson);
    if (!parsed.success) return errorResult(lessonError(parsed.error));
    try {
      const res = await createSlides(parsed.data.title, buildSlideRequests(parsed.data));
      return dualResult(`# Google Slides created\n\n${res.url}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Slides"));
    }
  },
});

export const formsFromQuizTool = defineTool({
  name: "google_forms_create_from_quiz",
  title: "Create Google Form (quiz) from Quiz",
  description: `Create a Google Form from a Quiz. If any question has a correct answer, the form is configured as a graded quiz with points and correct answers.

Args: quiz (a core Quiz object).
Returns (structuredContent): { id, url }. Requires forms.body scope.`,
  inputSchema: z.object({ quiz: z.unknown() }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    const parsed = Quiz.safeParse(args.quiz);
    if (!parsed.success) return errorResult(quizError(parsed.error));
    try {
      const { isQuiz, requests } = buildFormRequests(parsed.data);
      const res = await createForm(parsed.data.title, isQuiz, requests);
      return dualResult(`# Google Form created${isQuiz ? " (graded quiz)" : ""}\n\n${res.url}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Forms"));
    }
  },
});

export const sheetsCreateTool = defineTool({
  name: "google_sheets_create",
  title: "Create Google Sheet",
  description: `Create a Google Sheet. Provide either explicit headers+rows, or a Quiz (to export a question bank).

Args:
  - title (string)
  - headers?: string[]  and  rows?: (string|number)[][]   (explicit grid)
  - quiz?: a core Quiz (exported as a question bank if headers/rows omitted)
Returns (structuredContent): { id, url }. Requires spreadsheets scope.`,
  inputSchema: z
    .object({
      title: z.string().min(1),
      headers: z.array(z.string()).optional(),
      rows: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
      quiz: z.unknown().optional(),
    })
    .strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    try {
      let grid: (string | number)[][];
      if (args.headers && args.rows) {
        grid = buildSheetGrid({ headers: args.headers, rows: args.rows });
      } else if (args.quiz !== undefined) {
        const parsed = Quiz.safeParse(args.quiz);
        if (!parsed.success) return errorResult(quizError(parsed.error));
        grid = sheetGridFromQuiz(parsed.data);
      } else {
        return errorResult("Provide either headers+rows or quiz.");
      }
      const res = await createSheet(args.title, grid);
      return dualResult(`# Google Sheet created\n\n${res.url}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Sheets"));
    }
  },
});

export const driveCreateFolderTool = defineTool({
  name: "drive_create_folder",
  title: "Create Drive Folder",
  description: `Create a Google Drive folder.

Args: name (string), parentId? (string).
Returns (structuredContent): { id, url }. Requires drive.file scope.`,
  inputSchema: z.object({ name: z.string().min(1), parentId: z.string().optional() }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args) => {
    try {
      const res = await driveCreateFolder(args.name, args.parentId);
      return dualResult(`# Drive folder created\n\n${res.url}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Drive"));
    }
  },
});

export const driveUploadFileTool = defineTool({
  name: "drive_upload_file",
  title: "Upload File to Drive",
  description: `Upload a local file (e.g. a generated Kahoot .xlsx or Nearpod .pptx) to Google Drive.

Args: localPath (string), name? (string), folderId? (string).
Returns (structuredContent): { id, url }. Requires drive.file scope.`,
  inputSchema: z
    .object({ localPath: z.string().min(1), name: z.string().optional(), folderId: z.string().optional() })
    .strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    try {
      const res = await driveUploadFile(args.localPath, args.name, args.folderId);
      return dualResult(`# File uploaded to Drive\n\n${res.url}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Drive"));
    }
  },
});

export const driveSetSharingTool = defineTool({
  name: "drive_set_sharing",
  title: "Set Drive File Sharing",
  description: `Set sharing on a Drive file/folder.

Args: fileId (string), role ('reader'|'commenter'|'writer', default reader), type ('anyone'|'domain', default anyone).
Returns (structuredContent): { fileId, role, type }. Requires drive.file scope.`,
  inputSchema: z
    .object({
      fileId: z.string().min(1),
      role: z.enum(["reader", "commenter", "writer"]).default("reader"),
      type: z.enum(["anyone", "domain"]).default("anyone"),
    })
    .strict(),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  handler: async (args) => {
    try {
      const res = await driveSetSharing(args.fileId, args.role, args.type);
      return dualResult(`# Sharing updated\n\n${JSON.stringify(res)}`, res);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Drive"));
    }
  },
});

export const driveImportFolderTool = defineTool({
  name: "drive_import_folder",
  title: "Import a Drive Folder (batch download)",
  description: `Download every file in a Google Drive folder to a local directory so they can be ingested (e.g. an existing 教材庫). Google Docs/Sheets/Slides are exported to text/csv; other files download as-is.

Args: folderId (string), destDir? (defaults ./out/drive-import).
Returns (structuredContent): { dir, count, files: string[], errors }. Next: run content_ingest_folder on 'dir'. Requires drive.file scope.`,
  inputSchema: z.object({ folderId: z.string().min(1), destDir: z.string().optional() }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (args) => {
    try {
      const dir = args.destDir ?? path.join(process.cwd(), "out", "drive-import");
      const metas = await driveListFolder(args.folderId);
      const files: string[] = [];
      const errors: { name: string; error: string }[] = [];
      for (const m of metas) {
        try {
          files.push(await driveDownloadFile(m, dir));
        } catch (e) {
          errors.push({ name: m.name, error: e instanceof Error ? e.message : String(e) });
        }
      }
      const md = [`# Drive folder imported → ${dir}`, `- Downloaded: ${files.length}`, errors.length ? `- Failed: ${errors.length}` : ``]
        .filter(Boolean)
        .join("\n");
      return dualResult(md, { dir, count: files.length, files, errors });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Drive"));
    }
  },
});

export const formsReadTool = defineTool({
  name: "google_forms_read",
  title: "Read a Google Form (for remix)",
  description: `Read an existing Google Form into a simplified structure (title + questions with options) so it can be remixed/regenerated.

Args: formId (string).
Returns (structuredContent): { title, questions: [{prompt, type, options[]}] }. Requires forms.body scope.`,
  inputSchema: z.object({ formId: z.string().min(1) }).strict(),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (args) => {
    try {
      const form = await readForm(args.formId);
      const md = [`# ${form.title}`, ``, ...form.questions.map((q, i) => `${i + 1}. ${q.prompt} (${q.type})`)].join("\n");
      return dualResult(md, form);
    } catch (err) {
      return errorResult(handleApiError(err, "Google Forms"));
    }
  },
});

export const googleWorkspaceToolList: ToolDefinition[] = [
  docsFromLessonTool,
  docsCreateTool,
  slidesFromLessonTool,
  formsFromQuizTool,
  sheetsCreateTool,
  driveCreateFolderTool,
  driveUploadFileTool,
  driveSetSharingTool,
  driveImportFolderTool,
  formsReadTool,
] as unknown as ToolDefinition[];
