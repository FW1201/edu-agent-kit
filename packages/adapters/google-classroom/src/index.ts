/**
 * @interactive-edtech/google-classroom
 *
 * Google Classroom adapter — official API via googleapis + OAuth2. Exposes the
 * MCP tool array plus a few high-level helpers the server's workflow tool calls
 * directly (createCoursework / createMaterialWithLink).
 */
import type { classroom_v1 } from "googleapis";
import { getClassroom } from "./auth.js";
import { buildCourseWorkBody, buildMaterials, type CourseWorkInput } from "./builders.js";
import { tools } from "./tools.js";
import type { ToolDefinition } from "@interactive-edtech/mcp-shared";

/** All Google Classroom MCP tools, ready for the server to register. */
export const googleClassroomTools: ToolDefinition[] = tools;

/**
 * Create coursework (an assignment) in a course and return the created record.
 * Programmatic counterpart to the classroom_create_coursework tool, for the
 * server's workflow orchestration.
 */
export async function createCoursework(
  courseId: string,
  input: CourseWorkInput,
): Promise<classroom_v1.Schema$CourseWork> {
  const classroom = await getClassroom();
  const res = await classroom.courses.courseWork.create({
    courseId,
    requestBody: buildCourseWorkBody(input),
  });
  return res.data;
}

/**
 * Post a courseWorkMaterials item carrying a single external link. Convenience
 * for the workflow tool to attach generated artifacts (e.g. a slide deck URL).
 */
export async function createMaterialWithLink(
  courseId: string,
  title: string,
  linkUrl: string,
): Promise<classroom_v1.Schema$CourseWorkMaterial> {
  const classroom = await getClassroom();
  const res = await classroom.courses.courseWorkMaterials.create({
    courseId,
    requestBody: {
      title,
      state: "PUBLISHED",
      materials: buildMaterials([{ link: { url: linkUrl, title } }]),
    },
  });
  return res.data;
}

// Re-exports: auth client + pure builders for downstream/test use.
export { getClassroom, createOAuthClient, SCOPES } from "./auth.js";
export {
  buildCourseWorkBody,
  buildMaterials,
  buildAnnouncementBody,
  type CourseWorkInput,
  type AnnouncementInput,
  type MaterialInput,
  type DueDateInput,
  type DueTimeInput,
} from "./builders.js";
