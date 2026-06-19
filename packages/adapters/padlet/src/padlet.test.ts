import { describe, it, expect } from "vitest";
import { buildPostPayload } from "./client.js";
import type { BoardPost } from "@edu-agent-kit/core";

describe("buildPostPayload", () => {
  it("maps subject, body, color, and section", () => {
    const post: BoardPost = {
      subject: "Topic A",
      body: "Discuss this.",
      color: "blue",
      section: "sec-123",
    };
    const payload = buildPostPayload(post);
    expect(payload.data.type).toBe("post");
    expect(payload.data.attributes.content.subject).toBe("Topic A");
    expect(payload.data.attributes.content.body).toBe("Discuss this.");
    expect(payload.data.attributes.color).toBe("blue");
    expect(payload.data.relationships?.section?.data.id).toBe("sec-123");
  });

  it("maps media to an attachment with caption", () => {
    const post: BoardPost = {
      body: "See image",
      media: {
        kind: "image",
        url: "https://example.com/a.png",
        title: "A diagram",
      },
    };
    const payload = buildPostPayload(post);
    expect(payload.data.attributes.content.attachment?.url).toBe(
      "https://example.com/a.png",
    );
    expect(payload.data.attributes.content.attachment?.caption).toBe("A diagram");
  });

  it("omits optional fields when absent", () => {
    const post: BoardPost = { body: "Just a body" };
    const payload = buildPostPayload(post);
    expect(payload.data.attributes.content.subject).toBeUndefined();
    expect(payload.data.attributes.color).toBeUndefined();
    expect(payload.data.relationships).toBeUndefined();
  });
});
