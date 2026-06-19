/**
 * Google Classroom MCP tools.
 *
 * Each tool wraps an official Classroom API call, returns a dual (Markdown +
 * structured) result on success, and an actionable error result on failure.
 * List tools use Classroom's token-based pagination (pageSize / pageToken) and
 * surface `nextPageToken` in structuredContent.
 */
import { z } from "zod";
import type { classroom_v1 } from "googleapis";
import {
  defineTool,
  dualResult,
  errorResult,
  handleApiError,
  objectToMarkdown,
  type ToolDefinition,
} from "@edu-agent-kit/mcp-shared";
import { ResponseFormatSchema } from "@edu-agent-kit/core";
import { getClassroom } from "./auth.js";
import {
  buildAnnouncementBody,
  buildCourseWorkBody,
  buildMaterials,
  type AnnouncementInput,
  type CourseWorkInput,
  type MaterialInput,
} from "./builders.js";

/* ------------------------------------------------------------------ */
/* Shared schema fragments                                            */
/* ------------------------------------------------------------------ */

const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe("Max items per page (1-100). Classroom default applies when omitted.");

const pageTokenSchema = z
  .string()
  .optional()
  .describe("Opaque nextPageToken from a previous response, to fetch the next page.");

const materialSchema = z
  .object({
    link: z.object({ url: z.string().url(), title: z.string().optional() }).strict().optional(),
    driveFile: z
      .object({
        driveFileId: z.string(),
        shareMode: z.enum(["VIEW", "EDIT", "STUDENT_COPY"]).optional(),
        title: z.string().optional(),
      })
      .strict()
      .optional(),
    youtubeVideo: z.object({ videoId: z.string(), title: z.string().optional() }).strict().optional(),
    form: z.object({ formUrl: z.string().url(), title: z.string().optional() }).strict().optional(),
  })
  .strict();

const dueDateSchema = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  })
  .strict();

const dueTimeSchema = z
  .object({
    hours: z.number().int().min(0).max(23),
    minutes: z.number().int().min(0).max(59).optional(),
    seconds: z.number().int().min(0).max(59).optional(),
    nanos: z.number().int().min(0).optional(),
  })
  .strict();

/** Annotation presets. */
const readAnnotations = { readOnlyHint: true, openWorldHint: true } as const;
const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function courseSummary(c: classroom_v1.Schema$Course): Record<string, unknown> {
  return {
    id: c.id ?? null,
    name: c.name ?? null,
    section: c.section ?? null,
    room: c.room ?? null,
    state: c.courseState ?? null,
    enrollmentCode: c.enrollmentCode ?? null,
    alternateLink: c.alternateLink ?? null,
  };
}

function studentSummary(s: classroom_v1.Schema$Student): Record<string, unknown> {
  return {
    userId: s.userId ?? null,
    name: s.profile?.name?.fullName ?? null,
    email: s.profile?.emailAddress ?? null,
  };
}

function teacherSummary(t: classroom_v1.Schema$Teacher): Record<string, unknown> {
  return {
    userId: t.userId ?? null,
    name: t.profile?.name?.fullName ?? null,
    email: t.profile?.emailAddress ?? null,
  };
}

function submissionSummary(s: classroom_v1.Schema$StudentSubmission): Record<string, unknown> {
  return {
    id: s.id ?? null,
    userId: s.userId ?? null,
    courseWorkId: s.courseWorkId ?? null,
    state: s.state ?? null,
    late: s.late ?? null,
    assignedGrade: s.assignedGrade ?? null,
    draftGrade: s.draftGrade ?? null,
    alternateLink: s.alternateLink ?? null,
  };
}

/** Render a Markdown list of summaries, one objectToMarkdown block per item. */
function listMarkdown(title: string, items: Array<Record<string, unknown>>, nextPageToken?: string | null): string {
  if (items.length === 0) {
    return `## ${title}\n\n_No items._`;
  }
  const blocks = items.map((item, i) => objectToMarkdown(item, `${title} #${i + 1}`)).join("\n\n");
  const more = nextPageToken ? `\n\n_More results available. Pass pageToken=\`${nextPageToken}\` for the next page._` : "";
  return `## ${title} (${items.length})\n\n${blocks}${more}`;
}

/* ------------------------------------------------------------------ */
/* Courses                                                            */
/* ------------------------------------------------------------------ */

const listCourses = defineTool({
  name: "classroom_list_courses",
  title: "List Courses",
  description:
    "List Google Classroom courses the authenticated user can access.\n" +
    "Args: courseStates? (e.g. ACTIVE), teacherId?, studentId?, pageSize?, pageToken?, response_format?.\n" +
    "Returns: courses (id, name, section, state, enrollmentCode) and nextPageToken.\n" +
    "Examples: list all active courses; paginate with pageToken.\n" +
    "Errors: GOOGLE_TOKEN missing -> run the auth CLI; 403 -> insufficient scopes.",
  inputSchema: z
    .object({
      courseStates: z
        .array(z.enum(["COURSE_STATE_UNSPECIFIED", "ACTIVE", "ARCHIVED", "PROVISIONED", "DECLINED", "SUSPENDED"]))
        .optional()
        .describe("Filter by course state(s)."),
      teacherId: z.string().optional().describe("Restrict to courses with this teacher ('me' allowed)."),
      studentId: z.string().optional().describe("Restrict to courses with this student ('me' allowed)."),
      pageSize: pageSizeSchema,
      pageToken: pageTokenSchema,
      response_format: ResponseFormatSchema,
    })
    .strict(),
  annotations: readAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.list({
        courseStates: args.courseStates,
        teacherId: args.teacherId,
        studentId: args.studentId,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
      const courses = (res.data.courses ?? []).map(courseSummary);
      const nextPageToken = res.data.nextPageToken ?? null;
      return dualResult(listMarkdown("Courses", courses, nextPageToken), { courses, nextPageToken });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const createCourse = defineTool({
  name: "classroom_create_course",
  title: "Create Course",
  description:
    "Create a new Google Classroom course owned by the authenticated user.\n" +
    "Args: name (required), section?, description?, room?, ownerId? (defaults 'me'), courseState? (default PROVISIONED).\n" +
    "Returns: created course (id, name, enrollmentCode, alternateLink).\n" +
    "Examples: create 'Algebra I' with section 'Period 3'.\n" +
    "Errors: 403 -> caller lacks permission to create courses.",
  inputSchema: z
    .object({
      name: z.string().min(1).describe("Course display name."),
      section: z.string().optional(),
      description: z.string().optional(),
      room: z.string().optional(),
      ownerId: z.string().optional().describe("Owner user id; defaults to 'me'."),
      courseState: z.enum(["ACTIVE", "PROVISIONED", "DECLINED", "ARCHIVED", "SUSPENDED"]).optional(),
    })
    .strict(),
  annotations: writeAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.create({
        requestBody: {
          name: args.name,
          section: args.section,
          description: args.description,
          room: args.room,
          ownerId: args.ownerId ?? "me",
          courseState: args.courseState ?? "PROVISIONED",
        },
      });
      const course = courseSummary(res.data);
      return dualResult(objectToMarkdown(course, "Course created"), { course });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const getCourse = defineTool({
  name: "classroom_get_course",
  title: "Get Course",
  description:
    "Fetch a single Google Classroom course by id.\n" +
    "Args: courseId (required), response_format?.\n" +
    "Returns: course (id, name, section, room, state, enrollmentCode, alternateLink).\n" +
    "Examples: get course '123456'.\n" +
    "Errors: 404 -> no such course; 403 -> no access.",
  inputSchema: z
    .object({
      courseId: z.string().min(1).describe("Course id (or alias like 'd:shortname')."),
      response_format: ResponseFormatSchema,
    })
    .strict(),
  annotations: readAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.get({ id: args.courseId });
      const course = courseSummary(res.data);
      return dualResult(objectToMarkdown(course, "Course"), { course });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

/* ------------------------------------------------------------------ */
/* Content                                                            */
/* ------------------------------------------------------------------ */

const createCoursework = defineTool({
  name: "classroom_create_coursework",
  title: "Create Coursework (Assignment)",
  description:
    "Create coursework (an assignment) in a course. Builds the body via buildCourseWorkBody.\n" +
    "Args: courseId (required), title (required), description?, materials?, maxPoints?, dueDate{year,month,day}?, dueTime{hours,minutes?}?, topicId?, workType? (default ASSIGNMENT), state? (default PUBLISHED).\n" +
    "Returns: created coursework (id, title, state, alternateLink).\n" +
    "Examples: create 'Essay 1' worth 100 pts due 2026-07-01.\n" +
    "Errors: 400 -> invalid dueDate/dueTime; 404 -> course or topic missing.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      materials: z.array(materialSchema).optional(),
      maxPoints: z.number().min(0).optional(),
      dueDate: dueDateSchema.optional(),
      dueTime: dueTimeSchema.optional(),
      topicId: z.string().optional(),
      workType: z.enum(["ASSIGNMENT", "SHORT_ANSWER_QUESTION", "MULTIPLE_CHOICE_QUESTION"]).optional(),
      state: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    })
    .strict(),
  annotations: writeAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const input: CourseWorkInput = {
        title: args.title,
        description: args.description,
        materials: args.materials as MaterialInput[] | undefined,
        maxPoints: args.maxPoints,
        dueDate: args.dueDate,
        dueTime: args.dueTime,
        topicId: args.topicId,
        workType: args.workType,
        state: args.state,
      };
      const res = await classroom.courses.courseWork.create({
        courseId: args.courseId,
        requestBody: buildCourseWorkBody(input),
      });
      const coursework = {
        id: res.data.id ?? null,
        title: res.data.title ?? null,
        state: res.data.state ?? null,
        workType: res.data.workType ?? null,
        maxPoints: res.data.maxPoints ?? null,
        alternateLink: res.data.alternateLink ?? null,
      };
      return dualResult(objectToMarkdown(coursework, "Coursework created"), { coursework });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const createMaterial = defineTool({
  name: "classroom_create_material",
  title: "Create Course Material",
  description:
    "Create a courseWorkMaterials post (read-only reference material, not graded).\n" +
    "Args: courseId (required), title (required), description?, materials?, topicId?, state? (default PUBLISHED).\n" +
    "Returns: created material (id, title, state, alternateLink).\n" +
    "Examples: post a syllabus link as material.\n" +
    "Errors: 404 -> course or topic missing.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      materials: z.array(materialSchema).optional(),
      topicId: z.string().optional(),
      state: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    })
    .strict(),
  annotations: writeAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const materials = buildMaterials(args.materials as MaterialInput[] | undefined);
      const res = await classroom.courses.courseWorkMaterials.create({
        courseId: args.courseId,
        requestBody: {
          title: args.title,
          description: args.description,
          topicId: args.topicId,
          state: args.state ?? "PUBLISHED",
          materials: materials.length > 0 ? materials : undefined,
        },
      });
      const material = {
        id: res.data.id ?? null,
        title: res.data.title ?? null,
        state: res.data.state ?? null,
        alternateLink: res.data.alternateLink ?? null,
      };
      return dualResult(objectToMarkdown(material, "Material created"), { material });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const postAnnouncement = defineTool({
  name: "classroom_post_announcement",
  title: "Post Announcement",
  description:
    "Post an announcement to a course stream. Builds the body via buildAnnouncementBody.\n" +
    "Args: courseId (required), text (required), materials?, state? (default PUBLISHED).\n" +
    "Returns: created announcement (id, text, state, alternateLink).\n" +
    "Examples: announce 'Quiz moved to Friday' with a Drive link.\n" +
    "Errors: 404 -> course missing; 400 -> empty text.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      text: z.string().min(1),
      materials: z.array(materialSchema).optional(),
      state: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    })
    .strict(),
  annotations: writeAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const input: AnnouncementInput = {
        text: args.text,
        materials: args.materials as MaterialInput[] | undefined,
        state: args.state,
      };
      const res = await classroom.courses.announcements.create({
        courseId: args.courseId,
        requestBody: buildAnnouncementBody(input),
      });
      const announcement = {
        id: res.data.id ?? null,
        text: res.data.text ?? null,
        state: res.data.state ?? null,
        alternateLink: res.data.alternateLink ?? null,
      };
      return dualResult(objectToMarkdown(announcement, "Announcement posted"), { announcement });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const createTopic = defineTool({
  name: "classroom_create_topic",
  title: "Create Topic",
  description:
    "Create a topic (a stream section used to group coursework/materials).\n" +
    "Args: courseId (required), name (required).\n" +
    "Returns: created topic (topicId, name).\n" +
    "Examples: create topic 'Unit 1: Functions'.\n" +
    "Errors: 404 -> course missing; 409 -> duplicate topic name.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      name: z.string().min(1).describe("Topic display name."),
    })
    .strict(),
  annotations: writeAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.topics.create({
        courseId: args.courseId,
        requestBody: { name: args.name },
      });
      const topic = { topicId: res.data.topicId ?? null, name: res.data.name ?? null };
      return dualResult(objectToMarkdown(topic, "Topic created"), { topic });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

/* ------------------------------------------------------------------ */
/* Roster                                                             */
/* ------------------------------------------------------------------ */

const listStudents = defineTool({
  name: "classroom_list_students",
  title: "List Students",
  description:
    "List students enrolled in a course.\n" +
    "Args: courseId (required), pageSize?, pageToken?, response_format?.\n" +
    "Returns: students (userId, name, email) and nextPageToken.\n" +
    "Examples: roster the first 30 students; paginate with pageToken.\n" +
    "Errors: 403 -> requires classroom.rosters scope.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      pageSize: pageSizeSchema,
      pageToken: pageTokenSchema,
      response_format: ResponseFormatSchema,
    })
    .strict(),
  annotations: readAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.students.list({
        courseId: args.courseId,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
      const students = (res.data.students ?? []).map(studentSummary);
      const nextPageToken = res.data.nextPageToken ?? null;
      return dualResult(listMarkdown("Students", students, nextPageToken), { students, nextPageToken });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const addStudent = defineTool({
  name: "classroom_add_student",
  title: "Add Student",
  description:
    "Add a student to a course. A teacher cannot silently enroll an arbitrary user, so this creates a STUDENT invitation by default (the user accepts via email). If you instead pass the course enrollmentCode AND userId='me', it self-enrolls the caller as a student.\n" +
    "Args: courseId (required), userId (required; email or id, or 'me' for self-enroll), enrollmentCode? (only used for the userId='me' self-enroll path).\n" +
    "Returns: invitation (id, userId, role) OR enrolled student (userId, name, email), plus a `mode` field ('invitation' | 'enrollment').\n" +
    "Examples: invite 'alice@school.edu' as a student; or self-enroll with an enrollmentCode.\n" +
    "Errors: 403 -> caller not a teacher of the course; 404 -> course/user missing; 409 -> already invited/enrolled.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      userId: z.string().min(1).describe("Target user: email, numeric id, or 'me'."),
      enrollmentCode: z
        .string()
        .optional()
        .describe("Course enrollment code. Only honored for self-enrollment (userId='me')."),
    })
    .strict(),
  annotations: writeAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      // Self-enrollment path: only the caller can self-enroll with a code.
      if (args.userId === "me" && args.enrollmentCode) {
        const res = await classroom.courses.students.create({
          courseId: args.courseId,
          enrollmentCode: args.enrollmentCode,
          requestBody: { userId: "me" },
        });
        const student = studentSummary(res.data);
        return dualResult(objectToMarkdown({ mode: "enrollment", ...student }, "Student enrolled"), {
          mode: "enrollment",
          student,
        });
      }
      // Default path: teachers add students by invitation.
      const res = await classroom.invitations.create({
        requestBody: { courseId: args.courseId, userId: args.userId, role: "STUDENT" },
      });
      const invitation = {
        mode: "invitation",
        id: res.data.id ?? null,
        userId: res.data.userId ?? null,
        role: res.data.role ?? null,
      };
      return dualResult(objectToMarkdown(invitation, "Student invited"), { mode: "invitation", invitation });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const listTeachers = defineTool({
  name: "classroom_list_teachers",
  title: "List Teachers",
  description:
    "List teachers of a course.\n" +
    "Args: courseId (required), pageSize?, pageToken?, response_format?.\n" +
    "Returns: teachers (userId, name, email) and nextPageToken.\n" +
    "Examples: list co-teachers of a course.\n" +
    "Errors: 403 -> requires classroom.rosters scope.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      pageSize: pageSizeSchema,
      pageToken: pageTokenSchema,
      response_format: ResponseFormatSchema,
    })
    .strict(),
  annotations: readAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.teachers.list({
        courseId: args.courseId,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
      const teachers = (res.data.teachers ?? []).map(teacherSummary);
      const nextPageToken = res.data.nextPageToken ?? null;
      return dualResult(listMarkdown("Teachers", teachers, nextPageToken), { teachers, nextPageToken });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

/* ------------------------------------------------------------------ */
/* Submissions / Grading                                              */
/* ------------------------------------------------------------------ */

const listSubmissions = defineTool({
  name: "classroom_list_submissions",
  title: "List Student Submissions",
  description:
    "List student submissions for a coursework item.\n" +
    "Args: courseId (required), courseWorkId (required), userId? (filter to one student or 'me'), states? (e.g. TURNED_IN), pageSize?, pageToken?, response_format?.\n" +
    "Returns: submissions (id, userId, state, assignedGrade, draftGrade) and nextPageToken.\n" +
    "Examples: list all TURNED_IN submissions for an assignment.\n" +
    "Errors: 404 -> coursework missing; 403 -> insufficient scope.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      courseWorkId: z.string().min(1),
      userId: z.string().optional(),
      states: z
        .array(z.enum(["NEW", "CREATED", "TURNED_IN", "RETURNED", "RECLAIMED_BY_STUDENT"]))
        .optional()
        .describe("Filter by submission state(s)."),
      pageSize: pageSizeSchema,
      pageToken: pageTokenSchema,
      response_format: ResponseFormatSchema,
    })
    .strict(),
  annotations: readAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.courseWork.studentSubmissions.list({
        courseId: args.courseId,
        courseWorkId: args.courseWorkId,
        userId: args.userId,
        states: args.states,
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
      const submissions = (res.data.studentSubmissions ?? []).map(submissionSummary);
      const nextPageToken = res.data.nextPageToken ?? null;
      return dualResult(listMarkdown("Submissions", submissions, nextPageToken), { submissions, nextPageToken });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const getSubmission = defineTool({
  name: "classroom_get_submission",
  title: "Get Student Submission",
  description:
    "Fetch a single student submission.\n" +
    "Args: courseId (required), courseWorkId (required), submissionId (required), response_format?.\n" +
    "Returns: submission (id, userId, state, late, assignedGrade, draftGrade, alternateLink).\n" +
    "Examples: inspect one student's submission before grading.\n" +
    "Errors: 404 -> submission missing.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      courseWorkId: z.string().min(1),
      submissionId: z.string().min(1),
      response_format: ResponseFormatSchema,
    })
    .strict(),
  annotations: readAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const res = await classroom.courses.courseWork.studentSubmissions.get({
        courseId: args.courseId,
        courseWorkId: args.courseWorkId,
        id: args.submissionId,
      });
      const submission = submissionSummary(res.data);
      return dualResult(objectToMarkdown(submission, "Submission"), { submission });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

const returnGrade = defineTool({
  name: "classroom_return_grade",
  title: "Return Grade",
  description:
    "Grade and return a student submission. Patches assignedGrade (and draftGrade) via updateMask, then calls the API's return method so the student sees the grade.\n" +
    "Args: courseId (required), courseWorkId (required), submissionId (required), grade (required number), draftOnly? (default false -> when true, only saves a draft grade and does NOT return).\n" +
    "Returns: updated submission (id, assignedGrade, draftGrade, state) and returned (boolean).\n" +
    "Examples: assign 92 and return; or save a draft grade of 85 without returning.\n" +
    "Errors: 404 -> submission missing; 400 -> grade exceeds maxPoints.",
  inputSchema: z
    .object({
      courseId: z.string().min(1),
      courseWorkId: z.string().min(1),
      submissionId: z.string().min(1),
      grade: z.number().min(0).describe("Numeric grade to assign."),
      draftOnly: z
        .boolean()
        .optional()
        .describe("If true, only save a draft grade and do not return the submission."),
    })
    .strict(),
  annotations: writeAnnotations,
  handler: async (args): Promise<ReturnType<typeof dualResult>> => {
    try {
      const classroom = await getClassroom();
      const draftOnly = args.draftOnly ?? false;
      // Draft grade first; include assignedGrade too unless this is a draft-only save.
      const requestBody: classroom_v1.Schema$StudentSubmission = draftOnly
        ? { draftGrade: args.grade }
        : { draftGrade: args.grade, assignedGrade: args.grade };
      const updateMask = draftOnly ? "draftGrade" : "draftGrade,assignedGrade";
      const patched = await classroom.courses.courseWork.studentSubmissions.patch({
        courseId: args.courseId,
        courseWorkId: args.courseWorkId,
        id: args.submissionId,
        updateMask,
        requestBody,
      });
      let returned = false;
      if (!draftOnly) {
        await classroom.courses.courseWork.studentSubmissions.return({
          courseId: args.courseId,
          courseWorkId: args.courseWorkId,
          id: args.submissionId,
          requestBody: {},
        });
        returned = true;
      }
      const submission = {
        id: patched.data.id ?? args.submissionId,
        assignedGrade: patched.data.assignedGrade ?? (draftOnly ? null : args.grade),
        draftGrade: patched.data.draftGrade ?? args.grade,
        state: returned ? "RETURNED" : (patched.data.state ?? null),
        returned,
      };
      return dualResult(objectToMarkdown(submission, returned ? "Grade returned" : "Draft grade saved"), {
        submission,
        returned,
      });
    } catch (err) {
      return errorResult(handleApiError(err, "Google Classroom"));
    }
  },
});

/* ------------------------------------------------------------------ */
/* Export                                                             */
/* ------------------------------------------------------------------ */

/**
 * All Google Classroom tools, in a stable order. Each tool carries a narrower
 * inputSchema generic; widening to ToolDefinition (over AnyZodObject) is safe
 * here because the server only reads the schema and invokes the handler with
 * already-validated args.
 */
export const tools: ToolDefinition[] = [
  listCourses,
  createCourse,
  getCourse,
  createCoursework,
  createMaterial,
  postAnnouncement,
  createTopic,
  listStudents,
  addStudent,
  listTeachers,
  listSubmissions,
  getSubmission,
  returnGrade,
].map((tool) => tool as unknown as ToolDefinition);
