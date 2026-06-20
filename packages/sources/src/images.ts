import { promises as fs } from "node:fs";
import path from "node:path";
import { ToolError } from "@edu-agent-kit/mcp-shared";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export const IMAGE_EXTS = new Set(Object.keys(IMAGE_MIME));

export interface LoadedImage {
  base64: string;
  mimeType: string;
  title: string;
}

/**
 * Load an image file as base64 + mime. Used by content_ingest_image to hand the
 * image to the calling agent's built-in vision for transcription (best for
 * handwriting / 講義照片 / 黑板) — no external OCR API required.
 */
export async function loadImage(filePath: string): Promise<LoadedImage> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = IMAGE_MIME[ext];
  if (!mimeType) {
    throw new ToolError(
      `Unsupported image type '${ext}'. Supported: ${[...IMAGE_EXTS].join(", ")}.`,
      415,
    );
  }
  const buf = await fs.readFile(filePath);
  return { base64: buf.toString("base64"), mimeType, title: path.basename(filePath) };
}
