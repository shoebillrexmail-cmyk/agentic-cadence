import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Cadence Pipeline extension for Pi
 *
 * Provides `/pipeline` commands for autonomous story execution:
 * - /pipeline start <stories...|epic-name> [--mode single|parallel]
 * - /pipeline status [pipeline-id]
 * - /pipeline abort [pipeline-id]
 *
 * Coexists with cadence-flow.ts — no overlapping commands.
 * Pipeline state lives in <vault>/Pipeline/PIPELINE-<id>.md.
 *
 * This extension delegates to:
 * - shared/pipeline/pipeline-state.mjs (state management)
 * - shared/pipeline/cadence-pipeline-commands.mjs (argument parsing, resolution)
 */

export default function (pi: ExtensionAPI) {
  // ── Active Pipeline State ────────────────────────────
  let activePipelineId: string | null = null;

  // ── Vault Path Discovery ─────────────────────────────
  async function getVaultPaths(cwd: string) {
    const agentsMdPath = resolve(cwd, "AGENTS.md");
    try {
      const content = await readFile(agentsMdPath, "utf8");
      // Inline resolveVaultPaths to avoid dynamic import issues in extension
      const vaultLine = content.match(/Vault project:\s*(.+)/);
      const boardLine = content.match(/Sprint Board:\s*(.+)/);
      const backlogLine = content.match(/Product Backlog:\s*(.+)/);

      if (!vaultLine || !boardLine) return null;

      const sprintBoard = boardLine[1].trim().replace(/`/g, "");
      const projectDir = sprintBoard.replace(/[/\\]Sprint[/\\]Board\.md$/, "");

      return {
        projectName: vaultLine[1].trim(),
        sprintBoard,
        backlog: backlogLine ? backlogLine[1].trim().replace(/`/g, "") : "",
        storiesDir: resolve(projectDir, "Backlog", "Stories"),
        epicsDir: resolve(projectDir, "Backlog", "Epics"),
        pipelineDir: resolve(projectDir, "Pipeline"),
      };
    } catch {
      return null;
    }
  }

  // ── Check if story is already in progress ────────────
  async function isStoryInProgress(boardPath: string, storyName: string): Promise<boolean> {
    try {
      const board = await readFile(boardPath, "utf8");
      const inProgress = board.split("## In Progress")[1];
      if (!inProgress) return false;
      const section = inProgress.split("##")[0];
      return section.includes(`STORY-${storyName}`);
    } catch {
      return false;
    }
  }

  // ── Register Pipeline Command ────────────────────────

  pi.registerCommand("pipeline", {
    description: "Manage autonomous story pipeline: start, status, abort",
    getArgumentCompletions: (prefix: string) => {
      const parts = prefix.trim().split(/\s+/);
      if (parts.length <= 1) {
        return [
          { value: "start", label: "start <stories|epic> [--mode single|parallel] — Start pipeline execution" },
          { value: "status", label: "status [pipeline-id] — Show pipeline progress" },
          { value: "abort", label: "abort [pipeline-id] — Abort running pipeline" },
        ];
      }
      return null;
    },
    handler: async (args, ctx) => {
      const input = args.trim();
      const parts = input.split(/\s+/).filter(Boolean);

      if (parts.length === 0) {
        pi.sendUserMessage(
          "**Pipeline Commands:**\n\n" +
          "  `/pipeline start <stories...|epic-name> [--mode single|parallel]`\n" +
          "  `/pipeline status [pipeline-id]`\n" +
          "  `/pipeline abort [pipeline-id]`\n\n" +
          "Start autonomous execution of stories through the cadence lifecycle."
        );
        return;
      }

      // Resolve vault paths
      const vault = await getVaultPaths(ctx.cwd);
      if (!vault) {
        pi.sendUserMessage(
          "[Pipeline] No vault configuration found.\n" +
          "Ensure `AGENTS.md` exists with `## Obsidian Project` section containing vault paths.\n" +
          "Run `/skill:cadence-init` to set up."
        );
        return;
      }

      const subcommand = parts[0]?.toLowerCase();

      switch (subcommand) {
        case "start": {
          await handleStart(parts.slice(1), vault, ctx);
          break;
        }
        case "status": {
          await handleStatus(parts[1], vault, ctx);
          break;
        }
        case "abort": {
          await handleAbort(parts[1], vault, ctx);
          break;
        }
        default: {
          pi.sendUserMessage(
            `[Pipeline] Unknown subcommand: "${subcommand}"\n` +
            "Use: `start`, `status`, or `abort`."
          );
        }
      }
    },
  });

  // ── Start Handler ────────────────────────────────────

  async function handleStart(
    args: string[],
    vault: NonNullable<Awaited<ReturnType<typeof getVaultPaths>>>,
    ctx: any
  ) {
    // Parse arguments
    let mode = "single";
    const filtered: string[] = [];

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--mode" || args[i] === "-m") {
        mode = args[++i] || "single";
        continue;
      }
      if (args[i]?.startsWith("--mode=")) {
        mode = args[i].split("=")[1] || "single";
        continue;
      }
      if (args[i]) filtered.push(args[i]);
    }

    // Check for epic reference
    const epicRef = filtered.length === 1 && filtered[0].startsWith("EPIC-") ? filtered[0] : null;

    let storyNames: string[] = [];

    if (epicRef) {
      // Resolve stories from epic
      try {
        const epicContent = await readFile(
          resolve(vault.epicsDir, `${epicRef}.md`),
          "utf8"
        );
        const matches = epicContent.matchAll(/\[\[STORY-([^\]]+)\]\]/g);
        storyNames = [...matches].map((m) => m[1]);

        if (storyNames.length === 0) {
          pi.sendUserMessage(`[Pipeline] Epic "${epicRef}" contains no stories.`);
          return;
        }
      } catch {
        pi.sendUserMessage(`[Pipeline] Epic "${epicRef}" not found in ${vault.epicsDir}`);
        return;
      }
    } else {
      storyNames = filtered;
    }

    if (storyNames.length === 0) {
      pi.sendUserMessage(
        "[Pipeline] No stories specified.\n" +
        "Usage: `/pipeline start <story-names...> [--mode single|parallel]`\n" +
        "   or: `/pipeline start EPIC-<name> [--mode single|parallel]`"
      );
      return;
    }

    // Resolve stories and check status
    const resolved: string[] = [];
    const missing: string[] = [];
    const inProgress: string[] = [];

    for (const name of storyNames) {
      const filePath = resolve(vault.storiesDir, `STORY-${name}.md`);
      try {
        await readFile(filePath, "utf8");
        // Check if already in progress
        try {
          const board = await readFile(vault.sprintBoard, "utf8");
          const ipSection = board.split("## In Progress")[1]?.split("##")[0] || "";
          if (ipSection.includes(`STORY-${name}`)) {
            inProgress.push(name);
            continue;
          }
        } catch { /* no board, skip check */ }
        resolved.push(name);
      } catch {
        missing.push(name);
      }
    }

    // Report issues
    if (missing.length > 0) {
      pi.sendUserMessage(
        `[Pipeline] Stories not found: ${missing.join(", ")}\n` +
        `Looked in: ${vault.storiesDir}`
      );
    }

    if (inProgress.length > 0) {
      pi.sendUserMessage(
        `[Pipeline] Skipped (already in progress): ${inProgress.join(", ")}\n` +
        "Manual work takes priority — pipeline will not interfere."
      );
    }

    if (resolved.length === 0) {
      pi.sendUserMessage("[Pipeline] No stories to execute.");
      return;
    }

    // For now, the extension handles all logic inline.
    // Future: delegate to cadence-pipeline skill for execution orchestration.
    const modeLabel = mode === "parallel" ? "parallel (multi-agent)" : "sequential (single-agent)";
    pi.sendUserMessage(
      `[Pipeline] Pipeline ready: ${modeLabel} mode with ${resolved.length} stories:\n` +
      resolved.map((n) => `  - STORY-${n}`).join("\n") +
      `\n\nStories resolved from vault. Execution modules are at \`shared/pipeline/\`.`
    );
  }

  // ── Status Handler ───────────────────────────────────

  async function handleStatus(
    pipelineId: string | undefined,
    vault: NonNullable<Awaited<ReturnType<typeof getVaultPaths>>>,
    ctx: any
  ) {
    const id = pipelineId || activePipelineId;
    if (!id) {
      pi.sendUserMessage(
        "[Pipeline] No active pipeline. Start one with `/pipeline start`."
      );
      return;
    }

    try {
      const content = await readFile(
        resolve(vault.pipelineDir, `${id}.md`),
        "utf8"
      );

      // Parse basic info for display
      const stories: { name: string; status: string }[] = [];
      for (const line of content.split("\n")) {
        const rowMatch = line.match(
          /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/
        );
        if (!rowMatch) continue;
        const name = rowMatch[1].trim();
        if (name === "Name" || name.startsWith("---")) continue;
        stories.push({ name, status: rowMatch[2].trim() });
      }

      const total = stories.length;
      const done = stories.filter((s) => s.status === "done").length;
      const active = stories.filter((s) => s.status === "active").length;
      const failed = stories.filter((s) => s.status === "failed").length;

      let output = `## Pipeline: ${id}\n`;
      output += `**Progress**: ${done}/${total} done`;
      if (active > 0) output += `, ${active} active`;
      if (failed > 0) output += `, ${failed} failed`;
      output += "\n\n";

      output += "| Story | Status |\n|-------|--------|\n";
      for (const s of stories) {
        const icon =
          s.status === "done" ? "\u2705" :
          s.status === "active" ? "\uD83D\uDD34" :
          s.status === "failed" ? "\u274C" : "\u26AA";
        output += `| ${s.name} | ${icon} ${s.status} |\n`;
      }

      pi.sendUserMessage(output);
    } catch {
      pi.sendUserMessage(
        `[Pipeline] Pipeline "${id}" not found.\n` +
        "Use `/pipeline status` without arguments to see the active pipeline."
      );
    }
  }

  // ── Abort Handler ────────────────────────────────────

  async function handleAbort(
    pipelineId: string | undefined,
    vault: NonNullable<Awaited<ReturnType<typeof getVaultPaths>>>,
    ctx: any
  ) {
    const id = pipelineId || activePipelineId;
    if (!id) {
      pi.sendUserMessage(
        "[Pipeline] No active pipeline to abort."
      );
      return;
    }

    // Mark pipeline as aborted — future: terminate active workers
    pi.sendUserMessage(
      `[Pipeline] Pipeline "${id}" aborted.\n` +
      `State file preserved at: ${vault.pipelineDir}/${id}.md`
    );

    activePipelineId = null;
  }
}
