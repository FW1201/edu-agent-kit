import { promises as fs } from "node:fs";
import path from "node:path";
import { ToolError } from "@interactive-edtech/mcp-shared";
import type { SourceMaterial } from "@interactive-edtech/core";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const TEXT_EXTS = new Set([".txt", ".md", ".markdown", ".csv", ".json"]);

const NBSP = String.fromCharCode(160);

/**
 * Ingest a local file into a SourceMaterial. Supports PDF, DOCX, and plain
 * text/markdown. Throws ToolError for unsupported types or read failures.
 */
export async function ingestFile(filePath: string): Promise<SourceMaterial> {
  const ext = path.extname(filePath).toLowerCase();
  const title = path.basename(filePath);
  let text: string;
  let mimeType: string;

  try {
    if (ext === ".pdf") {
      const buf = await fs.readFile(filePath);
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
      mimeType = "application/pdf";
    } else if (ext === ".docx") {
      const buf = await fs.readFile(filePath);
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value;
      mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (TEXT_EXTS.has(ext)) {
      text = await fs.readFile(filePath, "utf8");
      mimeType = ext === ".json" ? "application/json" : "text/plain";
    } else {
      throw new ToolError(
        `Unsupported file type '${ext}'. Supported: .pdf, .docx, .txt, .md, .csv, .json.`,
        415,
      );
    }
  } catch (err) {
    if (err instanceof ToolError) throw err;
    throw new ToolError(
      `Failed to read '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Normalize non-breaking spaces and collapse excessive blank lines.
  const cleaned = text
    .split(NBSP)
    .join(" ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!cleaned) {
    throw new ToolError(`No extractable text found in '${filePath}'.`, 422);
  }

  return {
    id: makeId("file"),
    origin: "file",
    title,
    locator: filePath,
    mimeType,
    text: cleaned,
    excerpts: [],
    citations: [{ label: title }],
    retrievedAt: new Date().toISOString(),
  };
}
