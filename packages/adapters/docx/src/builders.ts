/**
 * Pure Word-document builders: core models → docx `Document`. No file I/O here
 * (see writer.ts), so the document structure is unit-testable.
 */
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import type { Lesson, Quiz, Question } from "@edu-agent-kit/core";

const LETTERS = "ABCDEFGHIJ";

function para(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)] });
}
function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 } });
}
function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({ text, heading: level });
}

/** Build a Word document (講義) from a Lesson. */
export function buildLessonDoc(lesson: Lesson): Document {
  const children: Paragraph[] = [heading(lesson.title, HeadingLevel.TITLE)];

  if (lesson.objectives.length) {
    children.push(heading("學習目標", HeadingLevel.HEADING_1));
    for (const o of lesson.objectives) children.push(bullet(o));
  }
  if (lesson.alignment) {
    children.push(heading("課綱對齊", HeadingLevel.HEADING_2));
    children.push(para(`${lesson.alignment.framework}｜${lesson.alignment.domain}｜${lesson.alignment.gradeLevel}`));
    for (const c of lesson.alignment.coreCompetencies) children.push(bullet(c));
  }

  lesson.slides.forEach((s, i) => {
    children.push(heading(`${i + 1}. ${s.title}`, HeadingLevel.HEADING_1));
    if (s.body) children.push(para(s.body));
    for (const b of s.bullets) children.push(bullet(b));
    if (s.embeddedQuestion) {
      children.push(...questionParagraphs(s.embeddedQuestion, true));
    }
    if (s.speakerNotes) {
      children.push(new Paragraph({ children: [new TextRun({ text: `教師備註：${s.speakerNotes}`, italics: true })] }));
    }
  });

  return new Document({ sections: [{ children }] });
}

function questionParagraphs(q: Question, withAnswers: boolean): Paragraph[] {
  const out: Paragraph[] = [new Paragraph({ children: [new TextRun({ text: q.prompt, bold: true })] })];
  q.options.forEach((o, i) => out.push(para(`(${LETTERS[i]}) ${o.text}`)));
  if (q.type === "fill_blank" || q.type === "short_answer" || q.type === "open_ended") {
    out.push(para("作答：＿＿＿＿＿＿＿＿＿＿＿＿＿＿"));
  }
  if (withAnswers) {
    const correct = q.options
      .map((o, i) => (o.correct ? LETTERS[i] : null))
      .filter((x): x is string => x !== null);
    if (correct.length) out.push(new Paragraph({ children: [new TextRun({ text: `✔ 正解：${correct.join(", ")}`, color: "1F7A1F" })] }));
    else if (q.acceptedAnswers.length) out.push(para(`✔ 參考答案：${q.acceptedAnswers.join(" / ")}`));
    if (q.explanation) out.push(new Paragraph({ children: [new TextRun({ text: `解析：${q.explanation}`, italics: true })] }));
  }
  return out;
}

/** Build a Word document (測驗卷/學習單) from a Quiz. `withAnswers` adds an answer key. */
export function buildQuizDoc(quiz: Quiz, withAnswers = false): Document {
  const children: Paragraph[] = [heading(quiz.title, HeadingLevel.TITLE)];
  if (quiz.gradeLevel || quiz.subject) {
    children.push(para([quiz.subject, quiz.gradeLevel].filter(Boolean).join("｜")));
  }
  children.push(para("姓名：＿＿＿＿＿＿　班級：＿＿＿＿＿＿　座號：＿＿＿"));
  quiz.questions.forEach((q, i) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. `, bold: true }), new TextRun({ text: q.prompt, bold: true })] }));
    q.options.forEach((o, idx) => children.push(para(`　(${LETTERS[idx]}) ${o.text}`)));
    if (q.type === "fill_blank" || q.type === "short_answer" || q.type === "open_ended") {
      children.push(para("　作答：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿"));
    }
  });
  if (withAnswers) {
    children.push(heading("解答 Answer Key", HeadingLevel.HEADING_1));
    quiz.questions.forEach((q, i) => {
      const correct = q.options.map((o, idx) => (o.correct ? LETTERS[idx] : null)).filter((x): x is string => x !== null);
      const ans = correct.length ? correct.join(", ") : q.acceptedAnswers.join(" / ");
      children.push(para(`${i + 1}. ${ans}${q.explanation ? `　—　${q.explanation}` : ""}`));
    });
  }
  return new Document({ sections: [{ children }] });
}
