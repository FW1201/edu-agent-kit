/**
 * @edu-agent-kit/docx
 *
 * Word (.docx) output — editable handouts, quizzes/worksheets (Taiwanese
 * teachers live in Word). Pure builders are exported for reuse/tests.
 */
import type { ToolDefinition } from "@edu-agent-kit/mcp-shared";
import { docxToolList } from "./tools.js";

export const docxTools: ToolDefinition[] = docxToolList;

export { buildLessonDoc, buildQuizDoc } from "./builders.js";
export { writeDocx } from "./writer.js";
export { lessonDocxTool, quizDocxTool } from "./tools.js";
