import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Cadence extension for Pi
 *
 * Replaces Claude Code's hooks system:
 * - session_shutdown: warns about stories still "In Progress" on the sprint board
 */

export default function (pi: ExtensionAPI) {
  // ── Session Shutdown Hook ──────────────────────────────
  // When pi exits, check if there are stories still "In Progress"
  // on the sprint board and warn the user (matching Claude's Stop hook)
  pi.on("session_shutdown", async (_event, ctx) => {
    try {
      const agentsMdPath = resolve(ctx.cwd, "AGENTS.md");
      const agentsMd = await readFile(agentsMdPath, "utf8");

      const match = agentsMd.match(/Sprint Board:\s*(.+)/);
      if (!match) return;

      const boardPath = match[1].trim().replace(/`/g, "");
      const board = await readFile(boardPath, "utf8");

      const inProgress = board.split("## In Progress")[1];
      if (!inProgress) return;

      const section = inProgress.split("##")[0];
      const items = section.match(/- \[.\].+/g);

      if (items && items.length > 0) {
        ctx.ui.notify(
          `[Cadence] ${items.length} stories still In Progress on the sprint board`,
          "warn"
        );
      }
    } catch {
      // No AGENTS.md, no board, or not in a project — silent exit
    }
  });

  // ── Register Commands ──────────────────────────────────
  // Aliases for quick access to skills
  pi.registerCommand("board", {
    description: "Show sprint board and backlog status",
    handler: async (_args, ctx) => {
      pi.sendUserMessage("/skill:cadence-board");
    },
  });

  pi.registerCommand("pickup", {
    description: "Pick up a story from the sprint board",
    getArgumentCompletions: (prefix: string) => {
      // Could scan board for Ready stories
      return null;
    },
    handler: async (args, _ctx) => {
      pi.sendUserMessage(`/skill:cadence-pickup ${args}`);
    },
  });

  pi.registerCommand("done", {
    description: "Complete current story — push, PR, review",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("/skill:cadence-done");
    },
  });

  pi.registerCommand("review", {
    description: "Run automated code review on current story",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("/skill:cadence-review");
    },
  });

  pi.registerCommand("learn", {
    description: "Extract learnings from completed story",
    handler: async (args, _ctx) => {
      pi.sendUserMessage(`/skill:cadence-learn ${args}`);
    },
  });

  pi.registerCommand("interview", {
    description: "Socratic interview to clarify a feature before story creation",
    handler: async (args, _ctx) => {
      pi.sendUserMessage(`/skill:cadence-interview ${args}`);
    },
  });
}
