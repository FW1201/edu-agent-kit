/**
 * Pure, network-free request builders for the Google Classroom API.
 *
 * These functions map plain adapter input into the `classroom_v1.Schema$*`
 * request bodies expected by googleapis. They contain NO I/O and are the unit
 * under test in `classroom.test.ts`.
 */
import type { classroom_v1 } from "googleapis";

/** A single material to attach to coursework, an announcement, or a material post. */
export interface MaterialInput {
  /** External link. */
  link?: { url: string; title?: string };
  /** Existing Google Drive file (by Drive file id). */
  driveFile?: { driveFileId: string; shareMode?: "VIEW" | "EDIT" | "STUDENT_COPY"; title?: string };
  /** YouTube video (by video id). */
  youtubeVideo?: { videoId: string; title?: string };
  /** Google Form (by responder/form URL). */
  form?: { formUrl: string; title?: string };
}

/** Calendar date for a coursework due date. */
export interface DueDateInput {
  year: number;
  month: number;
  day: number;
}

/** Time of day for a coursework due time (UTC, per the Classroom API). */
export interface DueTimeInput {
  hours: number;
  minutes?: number;
  seconds?: number;
  nanos?: number;
}

/** Input for building a coursework (assignment) request body. */
export interface CourseWorkInput {
  title: string;
  description?: string;
  materials?: MaterialInput[];
  maxPoints?: number;
  dueDate?: DueDateInput;
  dueTime?: DueTimeInput;
  topicId?: string;
  /** Defaults to "ASSIGNMENT". */
  workType?: "ASSIGNMENT" | "SHORT_ANSWER_QUESTION" | "MULTIPLE_CHOICE_QUESTION";
  /** Defaults to "PUBLISHED". */
  state?: "DRAFT" | "PUBLISHED";
}

/** Input for building an announcement request body. */
export interface AnnouncementInput {
  text: string;
  materials?: MaterialInput[];
  /** Defaults to "PUBLISHED". */
  state?: "DRAFT" | "PUBLISHED";
}

/**
 * Convert one MaterialInput into a Classroom Material. Returns `undefined` when
 * the entry carries no recognizable material so callers can filter it out.
 */
function buildMaterial(input: MaterialInput): classroom_v1.Schema$Material | undefined {
  if (input.link) {
    return { link: { url: input.link.url, title: input.link.title } };
  }
  if (input.driveFile) {
    return {
      driveFile: {
        driveFile: { id: input.driveFile.driveFileId, title: input.driveFile.title },
        shareMode: input.driveFile.shareMode ?? "VIEW",
      },
    };
  }
  if (input.youtubeVideo) {
    return { youtubeVideo: { id: input.youtubeVideo.videoId, title: input.youtubeVideo.title } };
  }
  if (input.form) {
    return { form: { formUrl: input.form.formUrl, title: input.form.title } };
  }
  return undefined;
}

/** Build an array of Classroom Materials, dropping empty entries. */
export function buildMaterials(input: MaterialInput[] | undefined): classroom_v1.Schema$Material[] {
  if (!input || input.length === 0) {
    return [];
  }
  const materials: classroom_v1.Schema$Material[] = [];
  for (const item of input) {
    const material = buildMaterial(item);
    if (material) {
      materials.push(material);
    }
  }
  return materials;
}

/** Build a CourseWork (assignment) request body from adapter input. */
export function buildCourseWorkBody(input: CourseWorkInput): classroom_v1.Schema$CourseWork {
  const body: classroom_v1.Schema$CourseWork = {
    title: input.title,
    workType: input.workType ?? "ASSIGNMENT",
    state: input.state ?? "PUBLISHED",
  };
  if (input.description !== undefined) {
    body.description = input.description;
  }
  if (typeof input.maxPoints === "number") {
    body.maxPoints = input.maxPoints;
  }
  if (input.topicId !== undefined) {
    body.topicId = input.topicId;
  }
  if (input.dueDate) {
    body.dueDate = {
      year: input.dueDate.year,
      month: input.dueDate.month,
      day: input.dueDate.day,
    };
  }
  if (input.dueTime) {
    body.dueTime = {
      hours: input.dueTime.hours,
      minutes: input.dueTime.minutes ?? 0,
      seconds: input.dueTime.seconds ?? 0,
      nanos: input.dueTime.nanos ?? 0,
    };
  }
  const materials = buildMaterials(input.materials);
  if (materials.length > 0) {
    body.materials = materials;
  }
  return body;
}

/** Build an Announcement request body from adapter input. */
export function buildAnnouncementBody(input: AnnouncementInput): classroom_v1.Schema$Announcement {
  const body: classroom_v1.Schema$Announcement = {
    text: input.text,
    state: input.state ?? "PUBLISHED",
  };
  const materials = buildMaterials(input.materials);
  if (materials.length > 0) {
    body.materials = materials;
  }
  return body;
}
