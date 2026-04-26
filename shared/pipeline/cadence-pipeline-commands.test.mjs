import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  parsePipelineArgs,
  resolveStoriesFromArgs,
  resolveStoriesFromEpic,
  formatPipelineStatus,
  resolveVaultPaths,
} from "./cadence-pipeline-commands.mjs";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("cadence-pipeline-commands", () => {
  let testDir;

  before(async () => {
    testDir = await mkdtemp(join(tmpdir(), "pipeline-ext-test-"));
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── parsePipelineArgs ───────────────────────────────
  describe("parsePipelineArgs()", () => {
    it("should parse start subcommand with story names", () => {
      const result = parsePipelineArgs("start story-a story-b");
      assert.equal(result.subcommand, "start");
      assert.deepEqual(result.stories, ["story-a", "story-b"]);
      assert.equal(result.mode, "single");
    });

    it("should parse start with --mode parallel", () => {
      const result = parsePipelineArgs("start --mode parallel story-a story-b");
      assert.equal(result.subcommand, "start");
      assert.equal(result.mode, "parallel");
      assert.deepEqual(result.stories, ["story-a", "story-b"]);
    });

    it("should parse start with epic reference", () => {
      const result = parsePipelineArgs("start EPIC-my-epic");
      assert.equal(result.subcommand, "start");
      assert.ok(result.epic);
      assert.equal(result.epic, "EPIC-my-epic");
    });

    it("should parse status subcommand", () => {
      const result = parsePipelineArgs("status");
      assert.equal(result.subcommand, "status");
    });

    it("should parse status with pipeline ID", () => {
      const result = parsePipelineArgs("status PIPELINE-test-001");
      assert.equal(result.subcommand, "status");
      assert.equal(result.pipelineId, "PIPELINE-test-001");
    });

    it("should parse abort subcommand", () => {
      const result = parsePipelineArgs("abort");
      assert.equal(result.subcommand, "abort");
    });

    it("should parse abort with pipeline ID", () => {
      const result = parsePipelineArgs("abort PIPELINE-test-001");
      assert.equal(result.subcommand, "abort");
      assert.equal(result.pipelineId, "PIPELINE-test-001");
    });

    it("should return null for empty input", () => {
      const result = parsePipelineArgs("");
      assert.equal(result.subcommand, null);
    });
  });

  // ── resolveStoriesFromArgs ───────────────────────────
  describe("resolveStoriesFromArgs()", () => {
    it("should resolve story names to story file paths", async () => {
      const storiesDir = join(testDir, "Stories");
      await mkdir(storiesDir, { recursive: true });
      await writeFile(join(storiesDir, "STORY-alpha.md"), "# Alpha");
      await writeFile(join(storiesDir, "STORY-beta.md"), "# Beta");

      const result = await resolveStoriesFromArgs(storiesDir, ["alpha", "beta"]);
      assert.equal(result.resolved.length, 2);
      assert.equal(result.resolved[0].name, "alpha");
      assert.ok(result.resolved[0].path.endsWith("STORY-alpha.md"));
      assert.equal(result.missing.length, 0);
    });

    it("should report missing stories", async () => {
      const storiesDir = join(testDir, "Stories-missing");
      await mkdir(storiesDir, { recursive: true });
      await writeFile(join(storiesDir, "STORY-alpha.md"), "# Alpha");

      const result = await resolveStoriesFromArgs(storiesDir, ["alpha", "nonexistent"]);
      assert.equal(result.resolved.length, 1);
      assert.equal(result.missing.length, 1);
      assert.equal(result.missing[0], "nonexistent");
    });
  });

  // ── resolveStoriesFromEpic ───────────────────────────
  describe("resolveStoriesFromEpic()", () => {
    it("should extract story links from epic file", async () => {
      const epicsDir = join(testDir, "Epics");
      await mkdir(epicsDir, { recursive: true });
      await writeFile(
        join(epicsDir, "EPIC-test.md"),
        `# Epic: Test\n\n## Stories\n- [[STORY-alpha]]\n- [[STORY-beta]]\n- [[STORY-gamma]]\n`
      );

      const result = await resolveStoriesFromEpic(epicsDir, "EPIC-test");
      assert.deepEqual(result, ["alpha", "beta", "gamma"]);
    });

    it("should return empty array for epic with no stories", async () => {
      const epicsDir = join(testDir, "Epics-empty");
      await mkdir(epicsDir, { recursive: true });
      await writeFile(join(epicsDir, "EPIC-empty.md"), "# Epic: Empty\n\nNo stories yet.\n");

      const result = await resolveStoriesFromEpic(epicsDir, "EPIC-empty");
      assert.deepEqual(result, []);
    });

    it("should throw for missing epic file", async () => {
      const epicsDir = join(testDir, "Epics-nope");
      await mkdir(epicsDir, { recursive: true });

      await assert.rejects(
        () => resolveStoriesFromEpic(epicsDir, "EPIC-nope"),
        /not found/i
      );
    });
  });

  // ── formatPipelineStatus ─────────────────────────────
  describe("formatPipelineStatus()", () => {
    it("should format active pipeline status", () => {
      const state = {
        id: "PIPELINE-test-001",
        mode: "parallel",
        createdAt: "2026-04-26T00:00:00Z",
        stories: [
          { name: "alpha", status: "done", completedAt: "2026-04-26T01:00:00Z" },
          { name: "beta", status: "active" },
          { name: "gamma", status: "queued" },
        ],
      };

      const output = formatPipelineStatus(state);
      assert.ok(output.includes("PIPELINE-test-001"));
      assert.ok(output.includes("parallel"));
      assert.ok(output.includes("alpha"));
      assert.ok(output.includes("done"));
      assert.ok(output.includes("beta"));
      assert.ok(output.includes("active"));
      assert.ok(output.includes("gamma"));
      assert.ok(output.includes("queued"));
    });

    it("should show completion summary when all done", () => {
      const state = {
        id: "PIPELINE-test-002",
        mode: "sequential",
        createdAt: "2026-04-26T00:00:00Z",
        stories: [
          { name: "alpha", status: "done", completedAt: "2026-04-26T01:00:00Z" },
          { name: "beta", status: "done", completedAt: "2026-04-26T02:00:00Z" },
        ],
      };

      const output = formatPipelineStatus(state);
      assert.ok(output.includes("complete") || output.includes("done"));
      assert.ok(output.includes("2/2"));
    });
  });

  // ── resolveVaultPaths ────────────────────────────────
  describe("resolveVaultPaths()", () => {
    it("should extract vault paths from AGENTS.md content", () => {
      const agentsMd = `## Obsidian Project
- Vault project: agentic-cadence
- Sprint Board: C:/Obsidian_Vaults/agentic-cadence/Sprint/Board.md
- Product Backlog: C:/Obsidian_Vaults/agentic-cadence/Backlog/Product-Backlog.md
- Specs: C:/Obsidian_Vaults/agentic-cadence/Specs/
- Research: C:/Obsidian_Vaults/agentic-cadence/Research/
`;

      const paths = resolveVaultPaths(agentsMd);
      assert.equal(paths.projectName, "agentic-cadence");
      assert.ok(paths.sprintBoard.includes("Sprint"));
      assert.ok(paths.backlog.includes("Backlog"));
      assert.ok(paths.storiesDir.includes("Stories"));
      assert.ok(paths.epicsDir.includes("Epics"));
      assert.ok(paths.pipelineDir.includes("Pipeline"));
    });

    it("should return null when no vault config found", () => {
      const paths = resolveVaultPaths("# Just a project\nNo vault config here.");
      assert.equal(paths, null);
    });
  });
});
