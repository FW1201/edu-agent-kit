import type { Quiz } from "@interactive-edtech/core";

/**
 * Wordwall template families this adapter can prepare content for.
 *
 * Wordwall has NO content-creation API: every activity is built in the web UI
 * and each item (question, pair, word, …) is typed in by hand. These helpers
 * therefore produce paste-ready artifacts (a CSV for spreadsheet-minded users
 * and a readable .txt the teacher copies item-by-item) — not an importable file.
 */
export type WordwallTemplate =
  | "quiz"
  | "match_up"
  | "anagram"
  | "group_sort"
  | "open_box_or_wheel";

/** A term ↔ definition pair (match_up / group source material). */
export interface WordwallPair {
  term: string;
  definition: string;
}

/** A named group with its member items (group_sort). */
export interface WordwallGroup {
  name: string;
  items: string[];
}

/**
 * Input for {@link buildWordwallContent}. Provide a core {@link Quiz} (content
 * is derived from its questions) and/or explicit lists. The template decides
 * which fields are used; unused fields are ignored and surfaced as warnings.
 */
export interface WordwallContentInput {
  /** Activity title (used as a header in the .txt). */
  title?: string;
  /** A core Quiz — questions are mapped per-template where applicable. */
  quiz?: Quiz;
  /** Explicit term/definition pairs (match_up). */
  pairs?: WordwallPair[];
  /** Explicit flat word/item list (anagram, open_box_or_wheel). */
  words?: string[];
  /** Explicit groups + items (group_sort). */
  groups?: WordwallGroup[];
}

/** Result of building Wordwall content: a CSV, a readable .txt, and warnings. */
export interface WordwallContent {
  csv: string;
  txt: string;
  warnings: string[];
}

/** RFC-4180-style CSV field escaping. */
function csvField(value: string): string {
  const v = value ?? "";
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Join a row of fields into a CSV line. */
function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",");
}

function firstCorrect(
  options: Quiz["questions"][number]["options"],
): string | undefined {
  return options.find((o) => o.correct)?.text;
}

/** Derive term/definition pairs from a Quiz (prompt → first correct answer). */
function pairsFromQuiz(quiz: Quiz, warnings: string[]): WordwallPair[] {
  const pairs: WordwallPair[] = [];
  quiz.questions.forEach((q, idx) => {
    const definition =
      firstCorrect(q.options) ?? q.acceptedAnswers[0] ?? undefined;
    if (definition) {
      pairs.push({ term: q.prompt, definition });
    } else {
      warnings.push(
        `Q${idx + 1}: no correct option/accepted answer — skipped for match_up.`,
      );
    }
  });
  return pairs;
}

/** Derive a flat word/item list from a Quiz (correct answers, else prompts). */
function wordsFromQuiz(quiz: Quiz): string[] {
  const words: string[] = [];
  for (const q of quiz.questions) {
    const w = firstCorrect(q.options) ?? q.acceptedAnswers[0] ?? q.prompt;
    if (w) words.push(w);
  }
  return words;
}

/**
 * Build Wordwall-ready content for a given template.
 *
 * Returns a CSV (one row per item, with a header row) plus a human-readable
 * .txt the teacher pastes into the Wordwall editor one item at a time. There is
 * NO bulk-import API; both artifacts are aids for manual entry.
 */
export function buildWordwallContent(
  input: WordwallContentInput,
  template: WordwallTemplate,
): WordwallContent {
  const warnings: string[] = [];
  const title = input.title ?? input.quiz?.title ?? "Wordwall activity";
  const csvLines: string[] = [];
  const txtLines: string[] = [`# ${title}`, `Template: ${template}`, ""];

  switch (template) {
    case "quiz": {
      const quiz = input.quiz;
      if (!quiz) {
        warnings.push("quiz template requires `quiz`; produced empty content.");
        csvLines.push(csvRow(["question", "answers", "correct"]));
        break;
      }
      csvLines.push(csvRow(["question", "answers", "correct"]));
      quiz.questions.forEach((q, idx) => {
        const answers = q.options.map((o) => o.text);
        const correct = q.options
          .filter((o) => o.correct)
          .map((o) => o.text);
        if (answers.length === 0) {
          // Fall back to accepted answers for open/fill types.
          const accepted = q.acceptedAnswers;
          csvLines.push(
            csvRow([q.prompt, accepted.join(" | "), accepted.join(" | ")]),
          );
          if (accepted.length === 0) {
            warnings.push(`Q${idx + 1}: no options or accepted answers.`);
          }
        } else {
          csvLines.push(
            csvRow([q.prompt, answers.join(" | "), correct.join(" | ")]),
          );
          if (correct.length === 0) {
            warnings.push(`Q${idx + 1}: no option marked correct.`);
          }
        }
        txtLines.push(`Q${idx + 1}. ${q.prompt}`);
        answers.forEach((a, i) => {
          const mark = q.options[i]?.correct ? " (correct)" : "";
          txtLines.push(`  ${String.fromCharCode(97 + i)}) ${a}${mark}`);
        });
        if (answers.length === 0 && q.acceptedAnswers.length > 0) {
          txtLines.push(`  answer: ${q.acceptedAnswers.join(" / ")}`);
        }
        txtLines.push("");
      });
      break;
    }

    case "match_up": {
      const pairs =
        input.pairs && input.pairs.length > 0
          ? input.pairs
          : input.quiz
            ? pairsFromQuiz(input.quiz, warnings)
            : [];
      if (pairs.length === 0) {
        warnings.push(
          "match_up template requires `pairs` or a `quiz`; produced empty content.",
        );
      }
      csvLines.push(csvRow(["term", "definition"]));
      pairs.forEach((p, idx) => {
        csvLines.push(csvRow([p.term, p.definition]));
        txtLines.push(`${idx + 1}. ${p.term}  ↔  ${p.definition}`);
      });
      break;
    }

    case "anagram": {
      const words =
        input.words && input.words.length > 0
          ? input.words
          : input.quiz
            ? wordsFromQuiz(input.quiz)
            : [];
      if (words.length === 0) {
        warnings.push(
          "anagram template requires `words` or a `quiz`; produced empty content.",
        );
      }
      csvLines.push(csvRow(["word"]));
      words.forEach((w, idx) => {
        csvLines.push(csvRow([w]));
        txtLines.push(`${idx + 1}. ${w}`);
      });
      break;
    }

    case "group_sort": {
      const groups = input.groups ?? [];
      if (groups.length === 0) {
        warnings.push(
          "group_sort template requires `groups`; produced empty content.",
        );
      }
      csvLines.push(csvRow(["group", "item"]));
      groups.forEach((g) => {
        txtLines.push(`Group: ${g.name}`);
        if (g.items.length === 0) {
          warnings.push(`Group "${g.name}" has no items.`);
        }
        g.items.forEach((item) => {
          csvLines.push(csvRow([g.name, item]));
          txtLines.push(`  - ${item}`);
        });
        txtLines.push("");
      });
      break;
    }

    case "open_box_or_wheel": {
      const items =
        input.words && input.words.length > 0
          ? input.words
          : input.quiz
            ? wordsFromQuiz(input.quiz)
            : [];
      if (items.length === 0) {
        warnings.push(
          "open_box_or_wheel template requires `words` or a `quiz`; produced empty content.",
        );
      }
      csvLines.push(csvRow(["item"]));
      items.forEach((item, idx) => {
        csvLines.push(csvRow([item]));
        txtLines.push(`${idx + 1}. ${item}`);
      });
      break;
    }

    default: {
      // Exhaustiveness guard.
      const _never: never = template;
      throw new Error(`Unsupported Wordwall template: ${String(_never)}`);
    }
  }

  return {
    csv: csvLines.join("\n") + "\n",
    txt: txtLines.join("\n").trimEnd() + "\n",
    warnings,
  };
}
