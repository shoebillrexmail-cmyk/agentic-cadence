import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkerStatus,
  formatPipelineSummary,
  writePipelineLog,
} from "./pipeline-visibility.mjs";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("pipeline-visibility", () => {
  let testDir;

  before(async () => {
    testDir = await mkdtemp(join(tmpdir(), "vis-test-"));
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── formatWorkerStatus ──────────────────────────────
  describe("formatWorkerStatus()", () => {
    it("should format single worker progress", () => {
      const output = formatWorkerStatus({
        storyName: "my-feature",
        status: "active",
        currentTool: "bash",
        tokensUsed: 1500,
        durationMs: 30000,
      });

      assert.ok(output.includes("my-feature"));
      assert.ok(output.includes("active"));
      assert.ok(output.includes("bash"));
    });

    it("should format worker with no tool info", () => {
      const output = formatWorkerStatus({
        storyName: "test",
        status: "queued",
      });

      assert.ok(output.includes("test"));
      assert.ok(output.includes("queued"));
    });
  });

  // ── formatPipelineSummary ───────────────────────────
  describe("formatPipelineSummary()", () => {
    it("should format completion summary", () => {
      const output = formatPipelineSummary({
        id: "PIPELINE-test-001",
        mode: "parallel",
        total: 3,
        passed: 2,
        failed: 1,
        durationMs: 180000,
        stories: [
          { name: "alpha", exitCode: 0, durationMs: 60000 },
          { name: "beta", exitCode: 0, durationMs: 50000 },
          { name: "gamma", exitCode: 1, durationMs: 70000 },
        ],
      });

      assert.ok(output.includes("PIPELINE-test-001"));
      assert.ok(output.includes("2/3"));
      assert.ok(output.includes("alpha"));
      assert.ok(output.includes("SUCCESS") || output.includes("PASS"));
      assert.ok(output.includes("gamma"));
      assert.ok(output.includes("FAIL"));
    });
  });

  // ── writePipelineLog ────────────────────────────────
  describe("writePipelineLog()", () => {
    it("should write markdown log file", async () => {
      const logDir = join(testDir, "logs");
      await mkdir(logDir, { recursive: true });

      await writePipelineLog(logDir, "PIPELINE-log-001", {
        id: "PIPELINE-log-001",
        mode: "sequential",
        startedAt: "2026-04-26T00:00:00Z",
        completedAt: "2026-04-26T00:10:00Z",
        results: [
          { name: "alpha", exitCode: 0 },
          { name: "beta", exitCode: 1, error: "timeout" },
        ],
      });

      const content = await readFile(join(logDir, "PIPELINE-log-001-log.md"), "utf8");
      assert.ok(content.includes("PIPELINE-log-001"));
      assert.ok(content.includes("alpha"));
      assert.ok(content.includes("beta"));
      assert.ok(content.includes("timeout"));
    });
  });
});
