/**
 * @edu-agent-kit/wayground
 *
 * Wayground (formerly Quizizz) adapter. No public content-creation API, so
 * creation is via an official spreadsheet import file. No public read API is
 * documented, so no read tool is exposed.
 */
import type { ToolDefinition } from "@edu-agent-kit/mcp-shared";
import { waygroundToolList } from "./tools.js";

export const waygroundTools: ToolDefinition[] = waygroundToolList;

export { buildWaygroundWorkbook } from "./workbook.js";
export { buildImportSpreadsheetTool } from "./tools.js";
