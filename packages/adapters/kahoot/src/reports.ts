import { httpRequest, requireEnv } from "@interactive-edtech/mcp-shared";

/**
 * Kahoot Reports API base. The Reports API is read-only and requires a Kahoot
 * EDU/enterprise plan with an API token (sent as a Bearer token). Endpoint
 * shapes follow Kahoot's "Guide to Kahoot reports API"; adjust paths per your
 * account if Kahoot revises them.
 */
export const KAHOOT_RESULTS_BASE = "https://results.kahoot.com";

function authHeader(): Record<string, string> {
  const key = requireEnv(
    "KAHOOT_API_KEY",
    "The Kahoot Reports API requires an EDU/enterprise plan token.",
  );
  return { Authorization: `Bearer ${key}` };
}

/** Fetch the list of available report summaries (most recent games). */
export async function listReports(limit = 20): Promise<unknown> {
  return httpRequest(`${KAHOOT_RESULTS_BASE}/rest/reports/list`, {
    headers: authHeader(),
    query: { limit },
  });
}

/** Fetch a single report's full payload by its report/session id. */
export async function getReport(reportId: string): Promise<unknown> {
  return httpRequest(
    `${KAHOOT_RESULTS_BASE}/rest/reports/${encodeURIComponent(reportId)}`,
    { headers: authHeader() },
  );
}

export interface KahootReportSummary {
  participants: number;
  averageScore: number | null;
  perQuestion: Array<{
    index: number;
    title?: string;
    correctPct: number | null;
  }>;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Compute summary statistics from a Kahoot report payload. Defensive against
 * field-name variation: looks for players/controllers and questions arrays and
 * derives participant count, average score, and per-question correctness.
 * Pure — no network.
 */
export function analyzeReport(report: unknown): KahootReportSummary {
  const r = asRecord(report);
  const players = asArray(r.players ?? r.controllers ?? r.participants);
  const questions = asArray(r.questions ?? r.kahootQuestions ?? r.metrics);

  const scores = players
    .map((p) => num(asRecord(p).totalScore ?? asRecord(p).score))
    .filter((n): n is number => n !== undefined);
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

  const perQuestion = questions.map((q, index) => {
    const qr = asRecord(q);
    const correct = num(qr.correctCount ?? qr.numCorrect);
    const totalAnswers = num(qr.totalAnswers ?? qr.numAnswers ?? qr.answerCount);
    let correctPct: number | null = null;
    if (correct !== undefined && totalAnswers && totalAnswers > 0) {
      correctPct = Math.round((correct / totalAnswers) * 100);
    } else if (num(qr.correctPercentage) !== undefined) {
      correctPct = Math.round(num(qr.correctPercentage) as number);
    }
    return {
      index: index + 1,
      title: typeof qr.title === "string" ? qr.title : undefined,
      correctPct,
    };
  });

  return {
    participants: players.length,
    averageScore,
    perQuestion,
  };
}
