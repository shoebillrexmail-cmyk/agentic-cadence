import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createPipelineState,
  readPipelineState,
  updateStoryStatus,
  parseDependsOn,
  buildDependencyGraph,
  getReadyStories,
  generatePipelineId,
} from "./pipeline-state.mjs";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("pipeline-state", () => {
  let testDir;

  before(async () => {
    testDir = await mkdtemp(join(tmpdir(), "pipeline-state-test-"));
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── generatePipelineId ──────────────────────────────
  describe("generatePipelineId()", () => {
    it("should generate an ID from an epic name", () => {
      const id = generatePipelineId("cadence-pipeline");
      assert.match(id, /^PIPELINE-cadence-pipeline-/);
    });

    it("should generate unique IDs on successive calls", () => {
      const a = generatePipelineId("test");
      const b = generatePipelineId("test");
      assert.notEqual(a, b);
    });
  });

  // ── createPipelineState ─────────────────────────────
  describe("createPipelineState()", () => {
    it("should create a pipeline state file with correct structure", async () => {
      const pipelineDir = join(testDir, "Pipeline");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-test-001";
      const stories = ["alpha", "beta", "gamma"];

      await createPipelineState(pipelineDir, { id, stories, mode: "sequential" });

      const content = await readFile(join(pipelineDir, `${id}.md`), "utf8");
      assert.ok(content.includes("# Pipeline: test-001"));
      assert.ok(content.includes("| alpha | queued |"));
      assert.ok(content.includes("| beta | queued |"));
      assert.ok(content.includes("| gamma | queued |"));
      assert.ok(content.includes("mode: sequential"));
    });
  });

  // ── readPipelineState ───────────────────────────────
  describe("readPipelineState()", () => {
    it("should parse an existing pipeline state file", async () => {
      const pipelineDir = join(testDir, "read-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-read-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["alpha", "beta"],
        mode: "parallel",
      });

      const state = await readPipelineState(pipelineDir, id);
      assert.equal(state.id, id);
      assert.equal(state.mode, "parallel");
      assert.equal(state.stories.length, 2);
      assert.equal(state.stories[0].name, "alpha");
      assert.equal(state.stories[0].status, "queued");
    });
  });

  // ── updateStoryStatus ───────────────────────────────
  describe("updateStoryStatus()", () => {
    it("should update a story's status in the state file", async () => {
      const pipelineDir = join(testDir, "update-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-update-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["alpha", "beta"],
        mode: "sequential",
      });

      await updateStoryStatus(pipelineDir, id, "alpha", "active");

      const state = await readPipelineState(pipelineDir, id);
      assert.equal(state.stories[0].status, "active");
      assert.equal(state.stories[1].status, "queued");
    });

    it("should record completion timestamp when marking done", async () => {
      const pipelineDir = join(testDir, "done-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-done-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["alpha"],
        mode: "sequential",
      });

      await updateStoryStatus(pipelineDir, id, "alpha", "done");

      const state = await readPipelineState(pipelineDir, id);
      assert.equal(state.stories[0].status, "done");
      assert.ok(state.stories[0].completedAt);
    });
  });

  // ── parseDependsOn ──────────────────────────────────
  describe("parseDependsOn()", () => {
    it("should read Depends-On from story frontmatter", () => {
      const storyContent = `---
name: story-b
Depends-On: [story-a, story-c]
---
# Story B
`;
      const deps = parseDependsOn(storyContent);
      assert.deepEqual(deps, ["story-a", "story-c"]);
    });

    it("should return empty array when no Depends-On field", () => {
      const storyContent = `---
name: story-a
---
# Story A
`;
      const deps = parseDependsOn(storyContent);
      assert.deepEqual(deps, []);
    });

    it("should handle single dependency without brackets", () => {
      const storyContent = `---
name: story-b
Depends-On: story-a
---
# Story B
`;
      const deps = parseDependsOn(storyContent);
      assert.deepEqual(deps, ["story-a"]);
    });
  });

  // ── buildDependencyGraph ────────────────────────────
  describe("buildDependencyGraph()", () => {
    it("should produce correct topological order for a simple chain", () => {
      const stories = [
        { name: "a", dependsOn: [] },
        { name: "b", dependsOn: ["a"] },
        { name: "c", dependsOn: ["b"] },
      ];
      const order = buildDependencyGraph(stories);
      assert.deepEqual(order, ["a", "b", "c"]);
    });

    it("should handle independent stories (no dependencies)", () => {
      const stories = [
        { name: "x", dependsOn: [] },
        { name: "y", dependsOn: [] },
        { name: "z", dependsOn: [] },
      ];
      const order = buildDependencyGraph(stories);
      assert.equal(order.length, 3);
      assert.ok(order.includes("x"));
      assert.ok(order.includes("y"));
      assert.ok(order.includes("z"));
    });

    it("should handle diamond dependency", () => {
      // a → b, a → c, b → d, c → d
      const stories = [
        { name: "d", dependsOn: ["b", "c"] },
        { name: "b", dependsOn: ["a"] },
        { name: "c", dependsOn: ["a"] },
        { name: "a", dependsOn: [] },
      ];
      const order = buildDependencyGraph(stories);
      // a must come before b and c, b and c before d
      assert.ok(order.indexOf("a") < order.indexOf("b"));
      assert.ok(order.indexOf("a") < order.indexOf("c"));
      assert.ok(order.indexOf("b") < order.indexOf("d"));
      assert.ok(order.indexOf("c") < order.indexOf("d"));
    });

    it("should throw on circular dependencies", () => {
      const stories = [
        { name: "a", dependsOn: ["b"] },
        { name: "b", dependsOn: ["c"] },
        { name: "c", dependsOn: ["a"] },
      ];
      assert.throws(
        () => buildDependencyGraph(stories),
        /circular/i
      );
    });

    it("should throw on self-dependency", () => {
      const stories = [
        { name: "a", dependsOn: ["a"] },
      ];
      assert.throws(
        () => buildDependencyGraph(stories),
        /circular/i
      );
    });
  });

  // ── getReadyStories ─────────────────────────────────
  describe("getReadyStories()", () => {
    it("should return only stories whose dependencies are all done", async () => {
      const pipelineDir = join(testDir, "ready-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-ready-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["a", "b", "c"],
        mode: "parallel",
      });

      // a is done, b is queued (depends on a), c is queued (independent)
      await updateStoryStatus(pipelineDir, id, "a", "done");

      const state = await readPipelineState(pipelineDir, id);

      // b depends on a (done), c has no deps
      const storyDeps = { a: [], b: ["a"], c: [] };
      const ready = getReadyStories(state.stories, storyDeps);
      assert.equal(ready.length, 2);
      assert.ok(ready.some((s) => s.name === "b"));
      assert.ok(ready.some((s) => s.name === "c"));
    });

    it("should return empty when all dependencies are blocked", async () => {
      const pipelineDir = join(testDir, "blocked-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-blocked-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["a", "b", "c"],
        mode: "sequential",
      });

      // a is active (not done), b depends on a
      await updateStoryStatus(pipelineDir, id, "a", "active");

      const state = await readPipelineState(pipelineDir, id);
      const storyDeps = { a: [], b: ["a"], c: ["b"] };
      const ready = getReadyStories(state.stories, storyDeps);
      // Only a is "active" (not ready), b and c blocked
      assert.equal(ready.length, 0);
    });

    it("should exclude stories that are not queued", async () => {
      const pipelineDir = join(testDir, "exclude-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-exclude-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["a", "b"],
        mode: "sequential",
      });

      await updateStoryStatus(pipelineDir, id, "a", "active");

      const state = await readPipelineState(pipelineDir, id);
      const storyDeps = { a: [], b: [] };
      const ready = getReadyStories(state.stories, storyDeps);
      // a is active (not queued), b is queued with no deps
      assert.equal(ready.length, 1);
      assert.equal(ready[0].name, "b");
    });
  });

  // ── Integration: full lifecycle ─────────────────────
  describe("full lifecycle", () => {
    it("should create → mark stories done → verify final state", async () => {
      const pipelineDir = join(testDir, "lifecycle-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-lifecycle-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["alpha", "beta", "gamma"],
        mode: "sequential",
      });

      // Mark all done
      await updateStoryStatus(pipelineDir, id, "alpha", "active");
      await updateStoryStatus(pipelineDir, id, "alpha", "done");
      await updateStoryStatus(pipelineDir, id, "beta", "active");
      await updateStoryStatus(pipelineDir, id, "beta", "done");
      await updateStoryStatus(pipelineDir, id, "gamma", "active");
      await updateStoryStatus(pipelineDir, id, "gamma", "done");

      const state = await readPipelineState(pipelineDir, id);
      assert.equal(state.stories.every((s) => s.status === "done"), true);
      assert.ok(state.stories.every((s) => s.completedAt));
    });

    it("should resume after a crash — identify incomplete stories", async () => {
      const pipelineDir = join(testDir, "resume-test");
      await mkdir(pipelineDir, { recursive: true });

      const id = "PIPELINE-resume-001";
      await createPipelineState(pipelineDir, {
        id,
        stories: ["alpha", "beta", "gamma"],
        mode: "parallel",
      });

      // Simulate crash: alpha done, beta active, gamma queued
      await updateStoryStatus(pipelineDir, id, "alpha", "active");
      await updateStoryStatus(pipelineDir, id, "alpha", "done");
      await updateStoryStatus(pipelineDir, id, "beta", "active");
      // crash! — beta is still "active", gamma is "queued"

      const state = await readPipelineState(pipelineDir, id);
      const incomplete = state.stories.filter(
        (s) => s.status !== "done" && s.status !== "failed"
      );
      assert.equal(incomplete.length, 2);
      assert.ok(incomplete.some((s) => s.name === "beta" && s.status === "active"));
      assert.ok(incomplete.some((s) => s.name === "gamma" && s.status === "queued"));
    });
  });
});
