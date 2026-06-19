/**
 * @edu-agent-kit/google-workspace
 *
 * Create Google Docs / Slides / Forms / Sheets and manage Drive from generated
 * teaching content, via shared OAuth. Pure builders are exported for reuse/tests.
 */
import type { ToolDefinition } from "@edu-agent-kit/mcp-shared";
import { googleWorkspaceToolList } from "./tools.js";

export const googleWorkspaceTools: ToolDefinition[] = googleWorkspaceToolList;

export {
  buildDocRequests,
  docInputFromLesson,
  buildSlideRequests,
  buildFormRequests,
  buildSheetGrid,
  sheetGridFromQuiz,
  type DocInput,
  type DocSection,
  type SheetInput,
} from "./builders.js";
export {
  createDoc,
  createSlides,
  createForm,
  createSheet,
  driveCreateFolder,
  driveUploadFile,
  driveSetSharing,
  type CreatedFile,
} from "./api.js";
