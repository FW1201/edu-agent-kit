/**
 * @interactive-edtech/nearpod
 *
 * Nearpod adapter. Nearpod has no public API; this adapter produces a Google
 * Slides-compatible .pptx lesson export to import via the Nearpod Google Slides
 * add-on.
 */
import type { ToolDefinition } from "@interactive-edtech/mcp-shared";
import { nearpodToolList } from "./tools.js";

export const nearpodTools: ToolDefinition[] = nearpodToolList;

export { buildNearpodPptx } from "./pptx.js";
export { buildSlidesExportTool } from "./tools.js";
