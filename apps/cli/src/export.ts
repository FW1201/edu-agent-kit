import { parseArgs } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Lesson, Quiz } from "@edu-agent-kit/core";
import {
  createDoc,
  createSlides,
  createForm,
  createSheet,
  driveUploadFile,
  buildDocRequests,
  docInputFromLesson,
  buildSlideRequests,
  buildFormRequests,
  sheetGridFromQuiz,
} from "@edu-agent-kit/google-workspace";
import { prepareHostingSite, deployHosting } from "@edu-agent-kit/firebase";

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function runExport(args: string[]): Promise<void> {
  const target = args[0];
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      lesson: { type: "string" },
      quiz: { type: "string" },
      file: { type: "string" },
      html: { type: "string" },
      title: { type: "string" },
      project: { type: "string" },
    },
    allowPositionals: true,
  });

  const need = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(msg);
  };

  let out: { id?: string; url: string };
  switch (target) {
    case "doc": {
      need(!!values.lesson, "export doc requires --lesson <lesson.json>");
      const lesson = Lesson.parse(await readJson(values.lesson!));
      out = await createDoc(lesson.title, buildDocRequests(docInputFromLesson(lesson)));
      break;
    }
    case "slides": {
      need(!!values.lesson, "export slides requires --lesson <lesson.json>");
      const lesson = Lesson.parse(await readJson(values.lesson!));
      out = await createSlides(lesson.title, buildSlideRequests(lesson));
      break;
    }
    case "form": {
      need(!!values.quiz, "export form requires --quiz <quiz.json>");
      const quiz = Quiz.parse(await readJson(values.quiz!));
      const { isQuiz, requests } = buildFormRequests(quiz);
      out = await createForm(quiz.title, isQuiz, requests);
      break;
    }
    case "sheet": {
      need(!!values.quiz, "export sheet requires --quiz <quiz.json>");
      const quiz = Quiz.parse(await readJson(values.quiz!));
      out = await createSheet(values.title ?? quiz.title, sheetGridFromQuiz(quiz));
      break;
    }
    case "drive": {
      need(!!values.file, "export drive requires --file <path>");
      out = await driveUploadFile(values.file!, values.title);
      break;
    }
    case "firebase": {
      need(!!values.html, "export firebase requires --html <file.html>");
      const projectId = values.project ?? process.env.FIREBASE_PROJECT;
      const token = process.env.FIREBASE_TOKEN;
      need(!!projectId, "Missing project id: pass --project or set FIREBASE_PROJECT");
      need(!!token, "Missing FIREBASE_TOKEN (firebase login:ci)");
      const html = await fs.readFile(values.html!, "utf8");
      const siteDir = path.join(os.tmpdir(), `eak-fb-${Date.now()}`);
      await prepareHostingSite({ html, siteDir, projectId: projectId! });
      out = await deployHosting({ siteDir, projectId: projectId!, token: token! });
      break;
    }
    default:
      throw new Error(`Unknown export target '${target ?? ""}'. Use: doc|slides|form|sheet|drive|firebase`);
  }
  process.stdout.write(`Exported ${target}: ${out.url}\n`);
}
