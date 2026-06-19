/**
 * OAuth scope registry. One entry per Google service this toolkit integrates;
 * `scopesFor` combines and de-duplicates the scopes for the services a user
 * enables, so a single stored token can cover everything they chose.
 */
export const SCOPE_REGISTRY = {
  classroom: [
    "https://www.googleapis.com/auth/classroom.courses",
    "https://www.googleapis.com/auth/classroom.coursework.students",
    "https://www.googleapis.com/auth/classroom.courseworkmaterials",
    "https://www.googleapis.com/auth/classroom.announcements",
    "https://www.googleapis.com/auth/classroom.rosters",
    "https://www.googleapis.com/auth/classroom.student-submissions.students.readwrite",
    "https://www.googleapis.com/auth/classroom.topics",
  ],
  docs: ["https://www.googleapis.com/auth/documents"],
  slides: ["https://www.googleapis.com/auth/presentations"],
  forms: ["https://www.googleapis.com/auth/forms.body"],
  sheets: ["https://www.googleapis.com/auth/spreadsheets"],
  // drive.file = per-file access to files the app creates/opens (least privilege).
  drive: ["https://www.googleapis.com/auth/drive.file"],
} as const;

export type GoogleService = keyof typeof SCOPE_REGISTRY;

/** All known services. */
export const ALL_SERVICES = Object.keys(SCOPE_REGISTRY) as GoogleService[];

/** Combine + de-duplicate scopes for the given services (default: all). */
export function scopesFor(...services: GoogleService[]): string[] {
  const pick = services.length > 0 ? services : ALL_SERVICES;
  const set = new Set<string>();
  for (const svc of pick) {
    for (const s of SCOPE_REGISTRY[svc]) set.add(s);
  }
  return [...set];
}
