/**
 * Cadence pipeline commands — argument parsing, story resolution, status formatting.
 *
 * Pure logic functions used by the cadence-pipeline Pi extension.
 * No side effects — these are testable in isolation.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

// ── parsePipelineArgs ─────────────────────────────────

/**
 * Parse pipeline command arguments.
 * @param {string} input - Raw argument string after `/pipeline `
 * @returns {{subcommand: string|null, stories: string[], mode: string, epic?: string, pipelineId?: string}}
 */
export function parsePipelineArgs(input) {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { subcommand: null, stories: [], mode: "single" };

  const subcommand = parts[0]?.toLowerCase();

  if (subcommand === "start") {
    const rest = parts.slice(1);
    let mode = "single";
    const filtered = [];

    for (const part of rest) {
      if (part === "--mode" || part === "-m") continue;
      if (part === "parallel" && filtered.length === 0 && rest.includes("--mode")) {
        mode = "parallel";
        continue;
      }
      if (part.startsWith("--mode=")) {
        mode = part.split("=")[1] || "single";
        continue;
      }
      filtered.push(part);
    }

    // Check if mode flag was before the value
    if (rest.includes("--mode") || rest.includes("-m")) {
      const modeIdx = rest.findIndex((p) => p === "--mode" || p === "-m");
      if (modeIdx >= 0 && rest[modeIdx + 1] === "parallel") {
        mode = "parallel";
        // Remove the mode value from filtered
        const valIdx = filtered.indexOf("parallel");
        if (valIdx >= 0) filtered.splice(valIdx, 1);
      }
    }

    // Check for epic reference
    const epic = filtered.length === 1 && filtered[0].startsWith("EPIC-") ? filtered[0] : undefined;

    return {
      subcommand: "start",
      stories: epic ? [] : filtered,
      mode,
      epic,
    };
  }

  if (subcommand === "status") {
    const pipelineId = parts[1] || undefined;
    return { subcommand: "status", pipelineId };
  }

  if (subcommand === "abort") {
    const pipelineId = parts[1] || undefined;
    return { subcommand: "abort", pipelineId };
  }

  return { subcommand: null, stories: [], mode: "single" };
}

// ── resolveStoriesFromArgs ────────────────────────────

/**
 * Resolve story names to story file paths.
 * @param {string} storiesDir - Vault stories directory
 * @param {string[]} names - Story names (without STORY- prefix)
 * @returns {Promise<{resolved: {name: string, path: string}[], missing: string[]}>}
 */
export async function resolveStoriesFromArgs(storiesDir, names) {
  const resolved = [];
  const missing = [];

  for (const name of names) {
    const filePath = join(storiesDir, `STORY-${name}.md`);
    try {
      await readFile(filePath, "utf8");
      resolved.push({ name, path: filePath });
    } catch {
      missing.push(name);
    }
  }

  return { resolved, missing };
}

// ── resolveStoriesFromEpic ────────────────────────────

/**
 * Extract story names linked in an epic file.
 * @param {string} epicsDir - Vault epics directory
 * @param {string} epicName - Epic file name (with or without EPIC- prefix)
 * @returns {Promise<string[]>} Story names (without STORY- prefix)
 */
export async function resolveStoriesFromEpic(epicsDir, epicName) {
  const fileName = epicName.startsWith("EPIC-") ? epicName : `EPIC-${epicName}`;
  const filePath = join(epicsDir, `${fileName}.md`);

  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Epic file not found: ${filePath}`);
  }

  // Extract [[STORY-xxx]] wiki links
  const matches = content.matchAll(/\[\[STORY-([^\]]+)\]\]/g);
  const stories = [...matches].map((m) => m[1]);
  return stories;
}

// ── formatPipelineStatus ──────────────────────────────

/**
 * Format pipeline state for display.
 * @param {{id: string, mode: string, createdAt: string, stories: {name: string, status: string, completedAt?: string}[]}} state
 * @returns {string}
 */
export function formatPipelineStatus(state) {
  const total = state.stories.length;
  const done = state.stories.filter((s) => s.status === "done").length;
  const active = state.stories.filter((s) => s.status === "active").length;
  const queued = state.stories.filter((s) => s.status === "queued").length;
  const failed = state.stories.filter((s) => s.status === "failed").length;

  const allDone = done === total;

  let output = `## Pipeline: ${state.id}\n`;
  output += `**Mode**: ${state.mode} | **Created**: ${state.createdAt}\n`;
  output += `**Progress**: ${done}/${total} done`;
  if (active > 0) output += `, ${active} active`;
  if (queued > 0) output += `, ${queued} queued`;
  if (failed > 0) output += `, ${failed} failed`;
  output += "\n\n";

  if (allDone) {
    output += `**Status**: Complete! All ${total} stories finished.\n\n`;
  }

  output += "| Story | Status |\n|-------|--------|\n";
  for (const s of state.stories) {
    const icon = s.status === "done" ? "\u2705" : s.status === "active" ? "\uD83D\uDD34" : s.status === "failed" ? "\u274C" : "\u26AA";
    output += `| ${s.name} | ${icon} ${s.status} |\n`;
  }

  return output;
}

// ── resolveVaultPaths ─────────────────────────────────

/**
 * Extract vault paths from AGENTS.md content.
 * @param {string} agentsMdContent
 * @returns {{projectName: string, sprintBoard: string, backlog: string, storiesDir: string, epicsDir: string, pipelineDir: string}|null}
 */
export function resolveVaultPaths(agentsMdContent) {
  const vaultLine = agentsMdContent.match(/Vault project:\s*(.+)/);
  const boardLine = agentsMdContent.match(/Sprint Board:\s*(.+)/);
  const backlogLine = agentsMdContent.match(/Product Backlog:\s*(.+)/);

  if (!vaultLine || !boardLine) return null;

  const projectName = vaultLine[1].trim();
  const sprintBoard = boardLine[1].trim().replace(/`/g, "");
  const backlog = backlogLine ? backlogLine[1].trim().replace(/`/g, "") : "";

  // Derive directories from the board path (go up to project root)
  const projectDir = sprintBoard.replace(/\/Sprint\/Board\.md$/, "").replace(/\\Sprint\\Board\.md$/, "");

  return {
    projectName,
    sprintBoard,
    backlog,
    storiesDir: join(projectDir, "Backlog", "Stories"),
    epicsDir: join(projectDir, "Backlog", "Epics"),
    pipelineDir: join(projectDir, "Pipeline"),
  };
}
