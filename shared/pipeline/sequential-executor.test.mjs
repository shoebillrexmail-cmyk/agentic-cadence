import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  executeSequentialPipeline,
  computeCompletionSummary,
} from "./sequential-executor.mjs";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("sequential-executor", () => {
  let testDir;

  before(async () => {
    testDir = await mkdtemp(join(tmpdir(), "seq-exec-test-"));
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── computeCompletionSummary ────────────────────────
  describe("computeCompletionSummary()", () => {
    it("should compute correct pass/fail/duration stats", () => {
      const results = [
        { name: "alpha", exitCode: 0, startedAt: "2026-04-26T00:00:00Z", completedAt: "2026-04-26T00:05:00Z" },
        { name: "beta", exitCode: 0, startedAt: "2026-04-26T00:05:00Z", completedAt: "2026-04-26T00:10:00Z" },
        { name: "gamma", exitCode: 1, startedAt: "2026-04-26T00:10:00Z", completedAt: "2026-04-26T00:12:00Z" },
      ];

      const summary = computeCompletionSummary(results);
      assert.equal(summary.total, 3);
      assert.equal(summary.passed, 2);
      assert.equal(summary.failed, 1);
      assert.ok(summary.totalDurationMs > 0);
    });

    it("should handle empty results", () => {
      const summary = computeCompletionSummary([]);
      assert.equal(summary.total, 0);
      assert.equal(summary.passed, 0);
      assert.equal(summary.failed, 0);
    });
  });

  // ── executeSequentialPipeline ───────────────────────
  describe("executeSequentialPipeline()", () => {
    it("should process stories in order using a mock worker", async () => {
      const pipelineDir = join(testDir, "seq-pipeline-1");
      const artifactDir = join(testDir, "seq-artifacts-1");
      await mkdir(pipelineDir, { recursive: true });
      await mkdir(artifactDir, { recursive: true });

      // Create pipeline state
      const stateFile = join(pipelineDir, "PIPELINE-seq-001.md");
      await writeFile(stateFile, [
        "# Pipeline: seq-001",
        "",
        "```yaml",
        "id: PIPELINE-seq-001",
        "mode: sequential",
        "created_at: 2026-04-26T00:00:00Z",
        "```",
        "",
        "## Stories",
        "",
        "| Name | Status | Started | Completed |",
        "|------|--------|---------|-----------|",
        "| alpha | queued | — | — |",
        "| beta | queued | — | — |",
      ].join("\n"), "utf8");

      // Mock worker that succeeds
      const mockWorker = async ({ storyName }) => ({
        exitCode: 0,
        events: [{ type: "agent_start" }, { type: "agent_end" }],
        output: `Completed ${storyName}`,
        error: "",
      });

      const results = await executeSequentialPipeline({
        pipelineDir,
        pipelineId: "PIPELINE-seq-001",
        stories: ["alpha", "beta"],
        artifactBaseDir: artifactDir,
        spawnWorker: mockWorker,
        storyDeps: { alpha: [], beta: ["alpha"] },
      });

      assert.equal(results.length, 2);
      assert.equal(results[0].name, "alpha");
      assert.equal(results[0].exitCode, 0);
      assert.equal(results[1].name, "beta");
      assert.equal(results[1].exitCode, 0);
    });

    it("should mark dependent stories as blocked when a story fails", async () => {
      const pipelineDir = join(testDir, "seq-pipeline-2");
      await mkdir(pipelineDir, { recursive: true });

      const stateFile = join(pipelineDir, "PIPELINE-seq-002.md");
      await writeFile(stateFile, [
        "# Pipeline: seq-002",
        "",
        "```yaml",
        "id: PIPELINE-seq-002",
        "mode: sequential",
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
      ].join("\n"), "utf8");

      // Alpha fails, beta depends on alpha, gamma is independent
      const mockWorker = async ({ storyName }) => ({
        exitCode: storyName === "alpha" ? 1 : 0,
        events: [],
        output: storyName === "alpha" ? "FAILED" : "OK",
        error: storyName === "alpha" ? "Error" : "",
      });

      const results = await executeSequentialPipeline({
        pipelineDir,
        pipelineId: "PIPELINE-seq-002",
        stories: ["alpha", "beta", "gamma"],
        artifactBaseDir: join(testDir, "seq-artifacts-2"),
        spawnWorker: mockWorker,
        storyDeps: { alpha: [], beta: ["alpha"], gamma: [] },
      });

      assert.equal(results.length, 3);
      assert.equal(results[0].name, "alpha");
      assert.equal(results[0].exitCode, 1);
      // beta should be blocked (depends on failed alpha)
      assert.equal(results[1].name, "beta");
      assert.equal(results[1].exitCode, -1); // -1 = blocked/skipped
      // gamma should still run (independent)
      assert.equal(results[2].name, "gamma");
      assert.equal(results[2].exitCode, 0);
    });
  });
});
