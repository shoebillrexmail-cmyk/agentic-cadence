import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

/**
 * Cadence extension for Pi
 *
 * Features:
 * - Session shutdown hook: warns about stories still "In Progress" on the sprint board
 * - Worktree auto-routing: when a worktree is active, ALL bash tool calls are
 *   transparently routed to the worktree directory via `cd <worktree> && <command>`.
 *   Pi's session stays in the main repo; the extension handles directory switching.
 * - Worktree management: /worktree create|list|remove|exit
 * - Skill aliases: /board, /pickup, /done, /review, /learn, /interview
 *
 *   When a worktree is active, the extension stores the worktree path in-memory.
 *   The /pickup command creates a worktree BEFORE delegating to the cadence-pickup
 *   skill, so all bash calls the skill makes are auto-routed to the worktree.
 *   /worktree exit clears the active worktree state, returning bash to the main repo.
 */

export default function (pi: ExtensionAPI) {
  // ── Active Worktree State ──────────────────────────────
  // When non-null, all bash tool calls get `cd <path> && ` prepended.
  // This is in-memory only — resets on extension reload (/reload).
  let activeWorktree: string | null = null;

  // ── Bash Tool Interceptor ──────────────────────────────
  // Transparently route ALL bash commands to the active worktree directory.
  // Pi's session cwd stays in the main repo; the extension handles the cd.
  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName === "bash" && activeWorktree) {
      // Prepend cd to the worktree — this makes every bash command
      // execute as if pi's cwd were the worktree directory.
      event.input.command = `cd "${activeWorktree}" && ${event.input.command}`;
    }
  });

  // ── Worktree Helpers ───────────────────────────────────
  function getRepoName(): string {
    try {
      return execSync(
        'basename -s .git "$(git remote get-url origin 2>/dev/null || echo "repo")" 2>/dev/null || echo "repo"',
        { encoding: "utf8" }
      ).trim();
    } catch {
      return "repo";
    }
  }

  function getWorktreeDir(storyName: string): string {
    const repoName = getRepoName();
    const cwd = process.cwd();
    // Resolve worktree relative to the repo root (parent of cwd if cwd is the repo)
    const repoRoot = execSync('git rev-parse --show-toplevel 2>/dev/null || echo "' + cwd + '"', {
      encoding: "utf8",
    }).trim();
    return resolve(repoRoot, "..", `${repoName}-worktrees`, `STORY-${storyName}`);
  }

  function createWorktree(storyName: string): { worktreeDir: string; branch: string } | { error: string } {
    const branch = `feature/STORY-${storyName}`;
    const worktreeDir = getWorktreeDir(storyName);

    // Check if worktree already exists
    try {
      const existing = execSync(`git worktree list 2>/dev/null | grep -E "/STORY-${storyName}\$" || true`, {
        encoding: "utf8",
      }).trim();
      if (existing) {
        return { worktreeDir, branch }; // Already exists, just return path
      }
    } catch {
      // ignore
    }

    try {
      execSync("git fetch origin 2>/dev/null", { stdio: "pipe" });

      // Try develop first, fall back to master
      const baseBranch = execSync(
        "git rev-parse --verify develop 2>/dev/null && echo 'develop' || echo 'master'",
        { encoding: "utf8" }
      ).trim();

      execSync(`git worktree add -b ${branch} "${worktreeDir}" ${baseBranch} 2>&1`, {
        stdio: "pipe",
        timeout: 30000,
      });

      // Symlink gitignored files
      const mainRepo = execSync(
        'git -C "$(git rev-parse --git-common-dir)" rev-parse --show-toplevel 2>/dev/null || echo ""',
        { encoding: "utf8" }
      ).trim();
      if (mainRepo) {
        for (const f of [".env", ".env.local", ".env.development", ".env.test"]) {
          try {
            execSync(
              `[ -f "${mainRepo}/${f}" ] && [ ! -f "${worktreeDir}/${f}" ] && ln -s "${mainRepo}/${f}" "${worktreeDir}/${f}"`,
              { stdio: "pipe" }
            );
          } catch {
            // file doesn't exist, skip
          }
        }
      }

      return { worktreeDir, branch };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  }

  // ── Session Shutdown Hook ──────────────────────────────
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

  pi.registerCommand("board", {
    description: "Show sprint board and backlog status",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("/skill:cadence-board");
    },
  });

  pi.registerCommand("pickup", {
    description: "Pick up a story from the sprint board",
    getArgumentCompletions: (prefix: string) => {
      return null;
    },
    handler: async (args, _ctx) => {
      const storyName = args.trim();

      if (storyName) {
        // Create the worktree FIRST, before delegating to the skill.
        // This sets activeWorktree so ALL bash calls from the skill
        // (including git operations, npm install, test runs) happen
        // in the worktree directory transparently.
        const result = createWorktree(storyName);

        if ("error" in result) {
          pi.sendUserMessage(
            `Warning: could not create worktree for ${storyName}: ${result.error}\n` +
            `Falling back to inline branch. The skill will handle setup.`
          );
          // Still proceed — the skill's Step 6 can create the worktree or branch
          pi.sendUserMessage(`/skill:cadence-pickup ${storyName}`);
          return;
        }

        const { worktreeDir, branch } = result;
        activeWorktree = worktreeDir;

        pi.sendUserMessage(
          `[Cadence] Worktree active at \`${worktreeDir}\` on \`${branch}\`.\n` +
          `All bash commands will run in the worktree. ` +
          `Run \`/worktree exit\` when done to return to the main repo.\n\n` +
          `Proceeding to pick up STORY-${storyName}...\n` +
          `/skill:cadence-pickup ${storyName}`
        );
      } else {
        // No story name — let the skill list options
        pi.sendUserMessage("/skill:cadence-pickup");
      }
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

  // ── Worktree Commands ─────────────────────────────────

  pi.registerCommand("worktree", {
    description: "Manage git worktrees: create, list, remove, exit",
    getArgumentCompletions: (prefix: string) => {
      const parts = prefix.trim().split(/\s+/);
      if (parts.length <= 1) {
        return [
          { value: "create", label: "create <story-name> — Create and activate a worktree" },
          { value: "list", label: "list — Show all worktrees" },
          { value: "remove", label: "remove <story-name> — Remove a worktree and its branch" },
          { value: "exit", label: "exit — Stop routing bash to the active worktree" },
          { value: "status", label: "status — Show the active worktree path" },
        ];
      }
      const sub = parts[0]?.toLowerCase();
      if ((sub === "create" || sub === "remove") && parts.length <= 2) {
        return null; // Let the user type the story name
      }
      return null;
    },
    handler: async (args, _ctx) => {
      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();

      switch (subcommand) {
        case "create": {
          const storyName = parts[1];
          if (!storyName) {
            return pi.sendUserMessage(
              "Usage: /worktree create <story-name>\n" +
              "Creates a git worktree on feature/STORY-<name> from develop and activates it.\n" +
              "All subsequent bash commands will run inside the worktree."
            );
          }
          const result = createWorktree(storyName);
          if ("error" in result) {
            return pi.sendUserMessage(`Failed to create worktree: ${result.error}`);
          }
          activeWorktree = result.worktreeDir;
          pi.sendUserMessage(
            `[Cadence] Worktree active at \`${result.worktreeDir}\` on \`${result.branch}\`.\n` +
            `All bash commands are now routed to the worktree. ` +
            `Run \`/worktree exit\` to stop routing and return bash to the main repo.`
          );
          break;
        }

        case "list": {
          try {
            const output = execSync("git worktree list", { encoding: "utf8" });
            let msg = `Worktrees:\n\`\`\`\n${output.trim()}\n\`\`\``;
            if (activeWorktree) {
              msg += `\n**Active worktree**: \`${activeWorktree}\``;
            }
            pi.sendUserMessage(msg);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            pi.sendUserMessage(`Failed to list worktrees: ${msg}`);
          }
          break;
        }

        case "remove": {
          const storyName = parts[1];
          if (!storyName) {
            return pi.sendUserMessage(
              "Usage: /worktree remove <story-name>\n" +
              "Removes the worktree for STORY-<name> and deletes its feature branch."
            );
          }

          const worktreeDir = getWorktreeDir(storyName);

          try {
            execSync(`git worktree remove "${worktreeDir}" 2>&1`, {
              stdio: "pipe",
              timeout: 10000,
            });
            execSync(`git branch -d feature/STORY-${storyName} 2>/dev/null || true`, {
              stdio: "pipe",
            });

            // Clear active worktree if that's the one we removed
            if (activeWorktree && resolve(activeWorktree) === resolve(worktreeDir)) {
              activeWorktree = null;
            }

            pi.sendUserMessage(
              `Worktree at \`${worktreeDir}\` and branch \`feature/STORY-${storyName}\` cleaned up.`
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            pi.sendUserMessage(`Failed to remove worktree: ${msg}`);
          }
          break;
        }

        case "exit": {
          if (!activeWorktree) {
            return pi.sendUserMessage("No active worktree — bash is running in the main repo cwd.");
          }
          pi.sendUserMessage(
            `[Cadence] Deactivated worktree routing for \`${activeWorktree}\`.\n` +
            `Bash commands will now run in the main repo cwd.\n` +
            `Your changes are preserved on the feature branch. ` +
            `To clean up: /worktree remove <story-name>`
          );
          activeWorktree = null;
          break;
        }

        case "status": {
          if (activeWorktree) {
            pi.sendUserMessage(
              `Active worktree: \`${activeWorktree}\`\n` +
              `All bash commands are routed here. Use \`/worktree exit\` to stop.`
            );
          } else {
            pi.sendUserMessage(
              "No active worktree. Bash commands run in the main repo.\n" +
              "Use /worktree create <story-name> to start one."
            );
          }
          break;
        }

        default: {
          pi.sendUserMessage(
            "Usage:\n" +
            "  /worktree create <story-name>  — Create + activate worktree on feature/STORY-<name>\n" +
            "  /worktree list                 — List all worktrees\n" +
            "  /worktree remove <story-name>  — Remove worktree and delete feature branch\n" +
            "  /worktree exit                 — Deactivate worktree routing (bash back to main repo)\n" +
            "  /worktree status               — Show which worktree is active"
          );
        }
      }
    },
  });
}
