import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildFirebaseJson, prepareHostingSite } from "./hosting.js";

const tmp = path.join(os.tmpdir(), `firebase-test-${Date.now()}`);

describe("buildFirebaseJson", () => {
  it("targets the public dir and ignores config", () => {
    const cfg = buildFirebaseJson();
    expect(cfg.hosting.public).toBe("public");
    expect(cfg.hosting.ignore).toContain("firebase.json");
  });
});

describe("prepareHostingSite", () => {
  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes index.html, firebase.json and .firebaserc from inline html", async () => {
    const siteDir = path.join(tmp, "site");
    await prepareHostingSite({
      html: "<h1>Hello class</h1>",
      siteDir,
      projectId: "demo-proj",
    });
    const indexHtml = await fs.readFile(path.join(siteDir, "public", "index.html"), "utf8");
    expect(indexHtml).toContain("Hello class");
    const fbjson = JSON.parse(await fs.readFile(path.join(siteDir, "firebase.json"), "utf8"));
    expect(fbjson.hosting.public).toBe("public");
    const rc = JSON.parse(await fs.readFile(path.join(siteDir, ".firebaserc"), "utf8"));
    expect(rc.projects.default).toBe("demo-proj");
  });
});
