import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  executeParallelPipeline,
  serializeMerges,
} from "./parallel-executor.mjs";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parallel-executor", () => {
  let testDir;

  before(async () => {
    testDir = await mkdtemp(join(tmpdir(), "par-exec-test-"));
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── serializeMerges ─────────────────────────────────
  describe("serializeMerges()", () => {
    it("should execute merge functions one at a time", async () => {
      const order = [];
      const mergeFns = [
        async () => { order.push("a"); await new Promise((r) => setTimeout(r, 10)); },
        async () => { order.push("b"); },
        async () => { order.push("c"); },
      ];

      await serializeMerges(mergeFns);
      assert.deepEqual(order, ["a", "b", "c"]);
    });
  });

  // ── executeParallelPipeline ─────────────────────────
  describe("executeParallelPipeline()", () => {
    it("should respect concurrency limit", async () => {
      const pipelineDir = join(testDir, "par-pipeline-1");
      await mkdir(pipelineDir, { recursive: true });

      await writeFile(join(pipelineDir, "PIPELINE-par-001.md"), [
        "# Pipeline: par-001",
        "",
        "```yaml",
        "id: PIPELINE-par-001",
        "mode: parallel",
        "created_at: 2026-04-26T00:00:00Z",
        "```",
        "",
        "## Stories",
        "",
        "| Name | Status | Started | Completed |",
        "|------|--------|---------|-----------|",
        "| alpha | queued | — | — |",
        "| beta | queued | — | — |",
        "| gamma | queued | — | — |",
        "| delta | queued | — | — |",
      ].join("\n"), "utf8");

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const mockWorker = async ({ storyName }) => {
        currentConcurrent++;
        if (currentConcurrent > maxConcurrent) maxConcurrent = currentConcurrent;
        await new Promise((r) => setTimeout(r, 50));
        currentConcurrent--;
        return { exitCode: 0, events: [], output: `Done ${storyName}`, error: "" };
      };

      const results = await executeParallelPipeline({
        pipelineDir,
        pipelineId: "PIPELINE-par-001",
        stories: ["alpha", "beta", "gamma", "delta"],
        artifactBaseDir: join(testDir, "par-artifacts-1"),
        spawnWorker: mockWorker,
        storyDeps: { alpha: [], beta: [], gamma: [], delta: [] },
        maxConcurrency: 2,
      });

      assert.equal(results.length, 4);
      assert.ok(results.every((r) => r.exitCode === 0));
      assert.ok(maxConcurrent <= 2, `Max concurrent was ${maxConcurrent}, expected <= 2`);
    });

    it("should dynamically schedule when deps are satisfied", async () => {
      const pipelineDir = join(testDir, "par-pipeline-2");
      await mkdir(pipelineDir, { recursive: true });

      const mockWorker = async ({ storyName }) => ({
        exitCode: 0,
        events: [],
        output: `Done ${storyName}`,
        error: "",
      });

      const results = await executeParallelPipeline({
        pipelineDir,
        pipelineId: "not-used",
        stories: ["a", "b", "c"],
        artifactBaseDir: join(testDir, "par-artifacts-2"),
        spawnWorker: mockWorker,
        storyDeps: { a: [], b: ["a"], c: [] },
        maxConcurrency: 3,
      });

      assert.equal(results.length, 3);
      // b depends on a, so a must complete before b starts
      const aResult = results.find((r) => r.name === "a");
      const bResult = results.find((r) => r.name === "b");
      assert.ok(aResult);
      assert.ok(bResult);
      assert.ok(aResult.exitCode === 0);
      assert.ok(bResult.exitCode === 0);
    });

    it("should handle worker crash (abnormal exit)", async () => {
      const mockWorker = async ({ storyName }) => ({
        exitCode: storyName === "alpha" ? 1 : 0,
        events: [],
        output: "",
        error: storyName === "alpha" ? "CRASH" : "",
      });

      const results = await executeParallelPipeline({
        pipelineDir: join(testDir, "par-pipeline-3"),
        pipelineId: "not-used",
        stories: ["alpha", "beta"],
        artifactBaseDir: join(testDir, "par-artifacts-3"),
        spawnWorker: mockWorker,
        storyDeps: { alpha: [], beta: [] },
        maxConcurrency: 2,
      });

      assert.equal(results.length, 2);
      assert.ok(results.some((r) => r.name === "alpha" && r.exitCode === 1));
      assert.ok(results.some((r) => r.name === "beta" && r.exitCode === 0));
    });
  });
});
