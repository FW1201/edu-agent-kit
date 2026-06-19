import { ToolError } from "./errors.js";

export interface HttpRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  /** JSON body — serialized automatically. */
  json?: unknown;
  /** Raw body (takes precedence over json). */
  body?: string | Uint8Array;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 30000;

function buildUrl(
  url: string,
  query?: HttpRequestOptions["query"],
): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/**
 * Shared fetch wrapper with timeout, JSON handling, and ToolError mapping.
 * Returns parsed JSON (or text when the response isn't JSON).
 */
export async function httpRequest<T = unknown>(
  url: string,
  opts: HttpRequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT,
  );
  try {
    const headers: Record<string, string> = { ...opts.headers };
    let body = opts.body;
    if (opts.json !== undefined && body === undefined) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body = JSON.stringify(opts.json);
    }
    const res = await fetch(buildUrl(url, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown = text;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json") && text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        /* fall back to text */
      }
    }

    if (!res.ok) {
      const detail =
        typeof parsed === "object" && parsed
          ? JSON.stringify(parsed).slice(0, 500)
          : String(parsed).slice(0, 500);
      throw new ToolError(
        `Request to ${url} failed (${res.status}): ${detail}`,
        res.status,
      );
    }
    return parsed as T;
  } finally {
    clearTimeout(timeout);
  }
}
