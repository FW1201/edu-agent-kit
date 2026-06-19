/**
 * @edu-agent-kit/kahoot
 *
 * Kahoot! adapter. Kahoot has no content-creation API, so creation is via an
 * official .xlsx import workbook. The Reports API (read-only, EDU/enterprise)
 * is exposed for pulling and analyzing game results.
 */
import type { ToolDefinition } from "@edu-agent-kit/mcp-shared";
import { kahootToolList } from "./tools.js";

export const kahootTools: ToolDefinition[] = kahootToolList;

export { buildKahootWorkbook } from "./workbook.js";
export { getReport, listReports, analyzeReport } from "./reports.js";
export {
  buildImportXlsxTool,
  getReportTool,
  analyzeResultsTool,
} from "./tools.js";
