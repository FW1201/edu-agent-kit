import { promises as fs } from "node:fs";
import path from "node:path";
import PptxGenJSImport from "pptxgenjs";
import type { Lesson, Slide } from "@edu-agent-kit/core";

// pptxgenjs ships a class+namespace default export that Node16 module resolution
// neither treats as constructable nor usable as a type. The runtime value IS the
// class, so we re-type it via a minimal structural interface of what we use.
type TextRun = { text: string; options?: Record<string, unknown> };
interface PptxSlide {
  addText(text: string | TextRun[], options?: Record<string, unknown>): unknown;
  addNotes(notes: string): unknown;
}
interface PptxDeck {
  layout: string;
  title: string;
  addSlide(): PptxSlide;
  writeFile(opts: { fileName: string }): Promise<string>;
}
const PptxGenJS = PptxGenJSImport as unknown as new () => PptxDeck;

const TITLE_OPTS = {
  x: 0.5,
  y: 0.3,
  w: 9,
  h: 1,
  fontSize: 28,
  bold: true,
  color: "1F2937",
} as const;

function renderQuestionLines(slide: Slide): string[] {
  const q = slide.embeddedQuestion;
  if (!q) return [];
  const lines = [`❓ ${q.prompt}`];
  q.options.forEach((o, i) => {
    lines.push(`${String.fromCharCode(65 + i)}. ${o.text}`);
  });
  return lines;
}

function noteFor(slide: Slide): string {
  const parts: string[] = [];
  if (slide.speakerNotes) parts.push(slide.speakerNotes);
  const q = slide.embeddedQuestion;
  if (q) {
    const correct = q.options
      .map((o, i) => (o.correct ? String.fromCharCode(65 + i) : null))
      .filter((x): x is string => x !== null);
    if (correct.length) parts.push(`Correct answer: ${correct.join(", ")}`);
    if (q.acceptedAnswers.length)
      parts.push(`Accepted: ${q.acceptedAnswers.join(" | ")}`);
    if (q.explanation) parts.push(`Explanation: ${q.explanation}`);
  }
  return parts.join("\n\n");
}

/**
 * Build a Google Slides-compatible .pptx from a Lesson. The teacher imports it
 * into Google Slides, then adds it to Nearpod via the Nearpod Google Slides
 * add-on (Nearpod has no public API — this is the faithful supported path).
 */
export async function buildNearpodPptx(
  lesson: Lesson,
  outPath: string,
): Promise<{ path: string; slideCount: number }> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = lesson.title;

  // Title slide
  const title = pptx.addSlide();
  title.addText(lesson.title, { ...TITLE_OPTS, y: 1.5, fontSize: 36 });
  if (lesson.objectives.length) {
    title.addText(
      lesson.objectives.map((o) => ({ text: o, options: { bullet: true } })),
      { x: 1, y: 3, w: 8, h: 3, fontSize: 16, color: "374151" },
    );
  }

  let slideCount = 1;
  for (const s of lesson.slides) {
    const slide = pptx.addSlide();
    slide.addText(s.title, TITLE_OPTS);

    const bodyLines: TextRun[] = [];
    if (s.body) bodyLines.push({ text: s.body });
    for (const b of s.bullets) {
      bodyLines.push({ text: b, options: { bullet: true } });
    }
    for (const ql of renderQuestionLines(s)) {
      bodyLines.push({ text: ql, options: { bullet: false } });
    }
    if (bodyLines.length) {
      slide.addText(bodyLines, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 4.5,
        fontSize: 16,
        color: "374151",
        valign: "top",
      });
    }

    const note = noteFor(s);
    if (note) slide.addNotes(note);
    slideCount += 1;
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await pptx.writeFile({ fileName: outPath });
  return { path: path.resolve(outPath), slideCount };
}
