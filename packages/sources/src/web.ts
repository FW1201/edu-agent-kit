import { parse } from "node-html-parser";
import {
  httpRequest,
  ToolError,
  optionalEnv,
  MissingCredentialError,
} from "@edu-agent-kit/mcp-shared";
import type { SourceMaterial } from "@edu-agent-kit/core";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip a fetched HTML document down to readable text. */
function htmlToText(html: string): { title?: string; text: string } {
  const root = parse(html, {
    blockTextElements: { script: false, style: false, noscript: false },
  });
  root.querySelectorAll("script,style,noscript,nav,footer,header,aside").forEach(
    (n) => n.remove(),
  );
  const title = root.querySelector("title")?.text?.trim();
  const main =
    root.querySelector("main") ??
    root.querySelector("article") ??
    root.querySelector("body") ??
    root;
  const text = main.text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return { title, text };
}

/** Fetch a URL and extract its readable text content into a SourceMaterial. */
export async function ingestUrl(url: string): Promise<SourceMaterial> {
  let html: string;
  try {
    html = await httpRequest<string>(url, {
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
  } catch (err) {
    if (err instanceof ToolError) throw err;
    throw new ToolError(
      `Failed to fetch '${url}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const { title, text } = htmlToText(html);
  if (!text) throw new ToolError(`No readable content extracted from '${url}'.`, 422);
  return {
    id: makeId("url"),
    origin: "url",
    title,
    locator: url,
    mimeType: "text/html",
    text,
    excerpts: [],
    citations: [{ label: title ?? url, url }],
    retrievedAt: new Date().toISOString(),
  };
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}
interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

/**
 * Web search via Tavily (set TAVILY_API_KEY or WEB_SEARCH_API_KEY). Returns one
 * SourceMaterial per result. Throws MissingCredentialError if no key is set.
 */
export async function webSearch(
  query: string,
  maxResults = 5,
): Promise<SourceMaterial[]> {
  const apiKey = optionalEnv("TAVILY_API_KEY") ?? optionalEnv("WEB_SEARCH_API_KEY");
  if (!apiKey) {
    throw new MissingCredentialError(
      "TAVILY_API_KEY",
      "Web search uses Tavily; set TAVILY_API_KEY (or WEB_SEARCH_API_KEY). Get one at https://tavily.com.",
    );
  }
  const resp = await httpRequest<TavilyResponse>(
    "https://api.tavily.com/search",
    {
      method: "POST",
      json: {
        api_key: apiKey,
        query,
        max_results: Math.min(Math.max(maxResults, 1), 20),
        search_depth: "advanced",
        include_answer: true,
      },
    },
  );
  const now = new Date().toISOString();
  return resp.results.map((r) => ({
    id: makeId("web"),
    origin: "web_search" as const,
    title: r.title,
    locator: query,
    mimeType: "text/plain",
    text: r.content,
    excerpts: [],
    citations: [{ label: r.title, url: r.url }],
    retrievedAt: now,
  }));
}
