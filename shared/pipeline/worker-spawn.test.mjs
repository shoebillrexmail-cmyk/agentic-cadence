import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkerPrompt,
  buildWorkerArgs,
  parseJsonEvent,
  resolveModelFlags,
  writeArtifacts,
  resolvePiCommand,
} from "./worker-spawn.mjs";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("worker-spawn", () => {
  let testDir;

  before(async () => {
    testDir = await mkdtemp(join(tmpdir(), "worker-spawn-test-"));
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── buildWorkerPrompt ───────────────────────────────
  describe("buildWorkerPrompt()", () => {
    it("should generate a prompt with cadence lifecycle instructions", () => {
      const story = {
        name: "my-feature",
        content: "# Story: My Feature\n\n## Acceptance Criteria\n- [ ] It works",
      };

      const prompt = buildWorkerPrompt(story);
      assert.ok(prompt.includes("my-feature"));
      assert.ok(prompt.includes("cadence"));
      assert.ok(prompt.includes("lifecycle") || prompt.includes("review"));
      assert.ok(prompt.includes("Acceptance Criteria"));
      assert.ok(prompt.includes("TDD"));
    });

    it("should include recursion guard instructions", () => {
      const story = { name: "test", content: "# Test" };
      const prompt = buildWorkerPrompt(story);
      assert.ok(prompt.includes("pipeline worker"));
      assert.ok(prompt.includes("subagent") || prompt.includes("sub-process"));
    });
  });

  // ── buildWorkerArgs ─────────────────────────────────
  describe("buildWorkerArgs()", () => {
    it("should assemble correct CLI arguments", () => {
      const args = buildWorkerArgs({
        cwd: "/path/to/worktree",
        model: "deepseek/deepseek-r1",
        thinking: "high",
        promptFile: "/tmp/prompt.md",
      });

      assert.ok(args.includes("--mode"));
      assert.ok(args.includes("json"));
      assert.ok(args.includes("-p"));
      assert.ok(args.includes("--cwd"));
      assert.ok(args.includes("/path/to/worktree"));
      assert.ok(args.includes("--model"));
      assert.ok(args.includes("deepseek/deepseek-r1"));
      assert.ok(args.includes("--thinking"));
      assert.ok(args.includes("high"));
    });

    it("should omit model flag when not specified", () => {
      const args = buildWorkerArgs({
        cwd: "/path/to/worktree",
        promptFile: "/tmp/prompt.md",
      });

      assert.ok(!args.includes("--model"));
      assert.ok(!args.includes("--thinking"));
    });

    it("should use @file reference for prompt", () => {
      const args = buildWorkerArgs({
        cwd: "/path/to/worktree",
        promptFile: "/tmp/task.md",
      });

      assert.ok(args.includes("@/tmp/task.md"));
    });
  });

  // ── parseJsonEvent ──────────────────────────────────
  describe("parseJsonEvent()", () => {
    it("should parse a valid JSON event line", () => {
      const event = parseJsonEvent('{"type":"agent_start"}');
      assert.equal(event.type, "agent_start");
    });

    it("should parse tool execution events", () => {
      const event = parseJsonEvent(
        '{"type":"tool_execution_start","toolCallId":"123","toolName":"bash","args":{"command":"ls"}}'
      );
      assert.equal(event.type, "tool_execution_start");
      assert.equal(event.toolName, "bash");
    });

    it("should return null for empty lines", () => {
      assert.equal(parseJsonEvent(""), null);
      assert.equal(parseJsonEvent("  "), null);
    });

    it("should return null for invalid JSON", () => {
      assert.equal(parseJsonEvent("not json"), null);
    });

    it("should handle session header", () => {
      const event = parseJsonEvent(
        '{"type":"session","version":3,"id":"uuid","cwd":"/path"}'
      );
      assert.equal(event.type, "session");
      assert.equal(event.version, 3);
    });
  });

  // ── resolveModelFlags ───────────────────────────────
  describe("resolveModelFlags()", () => {
    it("should resolve model and thinking from config", () => {
      const config = {
        worker_model: "deepseek/deepseek-r1",
        worker_thinking: "high",
      };
      const flags = resolveModelFlags(config);
      assert.equal(flags.model, "deepseek/deepseek-r1");
      assert.equal(flags.thinking, "high");
    });

    it("should return undefined when no config", () => {
      const flags = resolveModelFlags({});
      assert.equal(flags.model, undefined);
      assert.equal(flags.thinking, undefined);
    });

    it("should support fallback model", () => {
      const config = {
        worker_model: "deepseek/deepseek-r1",
        fallback_models: "huggingface/qwen-2.5-coder",
      };
      const flags = resolveModelFlags(config);
      assert.equal(flags.model, "deepseek/deepseek-r1");
      assert.deepEqual(flags.fallbacks, ["huggingface/qwen-2.5-coder"]);
    });
  });

  // ── writeArtifacts ──────────────────────────────────
  describe("writeArtifacts()", () => {
    it("should write all artifact files", async () => {
      const artifactDir = join(testDir, "artifacts", "STORY-test");
      await mkdir(artifactDir, { recursive: true });

      await writeArtifacts(artifactDir, {
        input: "# Story content",
        output: "# Result",
        events: [
          { type: "agent_start" },
          { type: "agent_end", messages: [] },
        ],
        meta: {
          story: "test",
          model: "deepseek/deepseek-r1",
          exitCode: 0,
          startedAt: "2026-04-26T00:00:00Z",
          completedAt: "2026-04-26T00:05:00Z",
        },
      });

      const input = await readFile(join(artifactDir, "input.md"), "utf8");
      assert.ok(input.includes("Story content"));

      const output = await readFile(join(artifactDir, "output.md"), "utf8");
      assert.ok(output.includes("Result"));

      const jsonl = await readFile(join(artifactDir, "events.jsonl"), "utf8");
      assert.equal(jsonl.split("\n").filter(Boolean).length, 2);

      const meta = JSON.parse(await readFile(join(artifactDir, "meta.json"), "utf8"));
      assert.equal(meta.exitCode, 0);
      assert.equal(meta.story, "test");
    });
  });

  // ── resolvePiCommand ────────────────────────────────
  describe("resolvePiCommand()", () => {
    it("should return a command string", () => {
      const cmd = resolvePiCommand();
      assert.ok(typeof cmd === "string");
      assert.ok(cmd.length > 0);
    });
  });
});
