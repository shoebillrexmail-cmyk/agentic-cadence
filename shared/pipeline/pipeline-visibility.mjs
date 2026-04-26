/**
 * Pipeline visibility — progress display, completion summaries, log files.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ── formatWorkerStatus ────────────────────────────────

/**
 * Format a single worker's status for display.
 * @param {{storyName: string, status: string, currentTool?: string, tokensUsed?: number, durationMs?: number}} worker
 * @returns {string}
 */
export function formatWorkerStatus({ storyName, status, currentTool, tokensUsed, durationMs }) {
  const icon = status === "active" ? "\uD83D\uDD34" : status === "done" ? "\u2705" : "\u26AA";
  let line = `${icon} STORY-${storyName} [${status}]`;

  if (currentTool) line += ` | tool: ${currentTool}`;
  if (tokensUsed) line += ` | tokens: ${tokensUsed}`;
  if (durationMs) line += ` | ${Math.round(durationMs / 1000)}s`;

  return line;
}

// ── formatPipelineSummary ─────────────────────────────

/**
 * Format pipeline completion summary.
 * @param {{id: string, mode: string, total: number, passed: number, failed: number, durationMs: number, stories: {name: string, exitCode: number, durationMs?: number}[]}} summary
 * @returns {string}
 */
export function formatPipelineSummary({ id, mode, total, passed, failed, durationMs, stories }) {
  const durationS = Math.round(durationMs / 1000);
  const lines = [
    `## Pipeline Complete: ${id}`,
    `**Mode**: ${mode} | **Duration**: ${durationS}s | **Results**: ${passed}/${total} passed, ${failed} failed`,
    "",
    "| Story | Status | Duration |",
    "|-------|--------|----------|",
  ];

  for (const s of stories) {
    const status = s.exitCode === 0 ? "\u2705 PASS" : "\u274C FAIL";
    const dur = s.durationMs ? `${Math.round(s.durationMs / 1000)}s` : "—";
    lines.push(`| STORY-${s.name} | ${status} | ${dur} |`);
  }

  return lines.join("\n");
}

// ── writePipelineLog ──────────────────────────────────

/**
 * Write a pipeline execution log as Markdown.
 * @param {string} logDir
 * @param {string} pipelineId
 * @param {{id: string, mode: string, startedAt: string, completedAt: string, results: {name: string, exitCode: number, error?: string}[]}} data
 */
export async function writePipelineLog(logDir, pipelineId, { id, mode, startedAt, completedAt, results }) {
  await mkdir(logDir, { recursive: true });

  const lines = [
    `# Pipeline Log: ${id}`,
    "",
    `- **Mode**: ${mode}`,
    `- **Started**: ${startedAt}`,
    `- **Completed**: ${completedAt}`,
    "",
    "## Results",
    "",
  ];

  for (const r of results) {
    const icon = r.exitCode === 0 ? "\u2705" : "\u274C";
    lines.push(`- ${icon} STORY-${r.name}: ${r.exitCode === 0 ? "SUCCESS" : "FAILED"}${r.error ? ` — ${r.error}` : ""}`);
  }

  await writeFile(join(logDir, `${pipelineId}-log.md`), lines.join("\n") + "\n", "utf8");
}
