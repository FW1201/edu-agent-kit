/**
 * Unit tests for the PURE Google Classroom request builders. No network calls.
 */
import { describe, it, expect } from "vitest";
import { buildCourseWorkBody, buildMaterials, buildAnnouncementBody } from "./builders.js";

describe("buildMaterials", () => {
  it("returns an empty array for undefined/empty input", () => {
    expect(buildMaterials(undefined)).toEqual([]);
    expect(buildMaterials([])).toEqual([]);
  });

  it("maps a link material", () => {
    const out = buildMaterials([{ link: { url: "https://example.com", title: "Example" } }]);
    expect(out).toEqual([{ link: { url: "https://example.com", title: "Example" } }]);
  });

  it("maps a drive file with default shareMode VIEW", () => {
    const out = buildMaterials([{ driveFile: { driveFileId: "file123", title: "Notes" } }]);
    expect(out).toEqual([
      { driveFile: { driveFile: { id: "file123", title: "Notes" }, shareMode: "VIEW" } },
    ]);
  });

  it("honors an explicit drive shareMode", () => {
    const out = buildMaterials([{ driveFile: { driveFileId: "f", shareMode: "STUDENT_COPY" } }]);
    expect(out[0]?.driveFile?.shareMode).toBe("STUDENT_COPY");
  });

  it("maps a youtube video", () => {
    const out = buildMaterials([{ youtubeVideo: { videoId: "abc", title: "Lesson" } }]);
    expect(out).toEqual([{ youtubeVideo: { id: "abc", title: "Lesson" } }]);
  });

  it("maps a form", () => {
    const out = buildMaterials([{ form: { formUrl: "https://forms.example/x" } }]);
    expect(out).toEqual([{ form: { formUrl: "https://forms.example/x", title: undefined } }]);
  });

  it("maps multiple materials and drops empty entries", () => {
    const out = buildMaterials([
      { link: { url: "https://a.test" } },
      {}, // empty -> dropped
      { youtubeVideo: { videoId: "vid" } },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveProperty("link");
    expect(out[1]).toHaveProperty("youtubeVideo");
  });
});

describe("buildCourseWorkBody", () => {
  it("applies defaults for workType and state", () => {
    const body = buildCourseWorkBody({ title: "HW 1" });
    expect(body.title).toBe("HW 1");
    expect(body.workType).toBe("ASSIGNMENT");
    expect(body.state).toBe("PUBLISHED");
    expect(body.materials).toBeUndefined();
    expect(body.dueDate).toBeUndefined();
    expect(body.dueTime).toBeUndefined();
  });

  it("maps description, maxPoints, and topicId when present", () => {
    const body = buildCourseWorkBody({
      title: "Essay",
      description: "Write 500 words",
      maxPoints: 100,
      topicId: "topic-1",
    });
    expect(body.description).toBe("Write 500 words");
    expect(body.maxPoints).toBe(100);
    expect(body.topicId).toBe("topic-1");
  });

  it("maps a due date", () => {
    const body = buildCourseWorkBody({ title: "X", dueDate: { year: 2026, month: 7, day: 1 } });
    expect(body.dueDate).toEqual({ year: 2026, month: 7, day: 1 });
  });

  it("maps due time, defaulting minutes/seconds/nanos to 0", () => {
    const body = buildCourseWorkBody({ title: "X", dueTime: { hours: 23 } });
    expect(body.dueTime).toEqual({ hours: 23, minutes: 0, seconds: 0, nanos: 0 });
  });

  it("includes materials only when non-empty", () => {
    const withMat = buildCourseWorkBody({ title: "X", materials: [{ link: { url: "https://m.test" } }] });
    expect(withMat.materials).toHaveLength(1);
    const noMat = buildCourseWorkBody({ title: "X", materials: [{}] });
    expect(noMat.materials).toBeUndefined();
  });

  it("respects explicit workType and state overrides", () => {
    const body = buildCourseWorkBody({ title: "Q", workType: "MULTIPLE_CHOICE_QUESTION", state: "DRAFT" });
    expect(body.workType).toBe("MULTIPLE_CHOICE_QUESTION");
    expect(body.state).toBe("DRAFT");
  });

  it("allows maxPoints of 0 (ungraded-but-tracked)", () => {
    const body = buildCourseWorkBody({ title: "X", maxPoints: 0 });
    expect(body.maxPoints).toBe(0);
  });
});

describe("buildAnnouncementBody", () => {
  it("defaults state to PUBLISHED and carries text", () => {
    const body = buildAnnouncementBody({ text: "Welcome!" });
    expect(body.text).toBe("Welcome!");
    expect(body.state).toBe("PUBLISHED");
    expect(body.materials).toBeUndefined();
  });

  it("includes materials when provided", () => {
    const body = buildAnnouncementBody({
      text: "See attached",
      materials: [{ link: { url: "https://x.test", title: "Doc" } }],
    });
    expect(body.materials).toHaveLength(1);
    expect(body.materials?.[0]).toEqual({ link: { url: "https://x.test", title: "Doc" } });
  });

  it("respects DRAFT state", () => {
    const body = buildAnnouncementBody({ text: "Hi", state: "DRAFT" });
    expect(body.state).toBe("DRAFT");
  });
});
