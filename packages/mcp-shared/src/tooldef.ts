import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/** A text content block. */
export interface TextContent {
  type: "text";
  text: string;
}
/** An image content block (base64) — lets a tool hand an image to the agent's vision. */
export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}
export type ContentBlock = TextContent | ImageContent;

/** Standard MCP tool result shape used by every tool in the suite. */
export interface ToolResult {
  content: ContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Platform-agnostic tool definition. Adapters export arrays of these; the
 * server collects and registers them. Keeps adapters decoupled from the
 * MCP SDK registration call while staying fully typed.
 */
export interface ToolDefinition<T extends z.AnyZodObject = z.AnyZodObject> {
  name: string;
  title: string;
  description: string;
  inputSchema: T;
  annotations?: ToolAnnotations;
  handler: (args: z.infer<T>) => Promise<ToolResult>;
}

/** Identity helper that preserves Zod inference for handler args. */
export function defineTool<T extends z.AnyZodObject>(
  def: ToolDefinition<T>,
): ToolDefinition<T> {
  return def;
}

/** A plain text result. */
export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/** A result carrying both human text and machine-readable structured content. */
export function dualResult(text: string, structured: object): ToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent: structured as Record<string, unknown>,
  };
}

/** An error result (isError=true) with an actionable message. */
export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * A result that hands an image to the agent (for its built-in vision to read/
 * transcribe) plus a guiding text instruction and optional structured data.
 */
export function imageResult(
  base64: string,
  mimeType: string,
  text: string,
  structured?: object,
): ToolResult {
  return {
    content: [
      { type: "text", text },
      { type: "image", data: base64, mimeType },
    ],
    ...(structured ? { structuredContent: structured as Record<string, unknown> } : {}),
  };
}

export type { ToolAnnotations };
