/**
 * Sequential pipeline executor — processes stories one at a time in dependency order.
 *
 * Each story gets its own Pi subprocess worker. The orchestrator tracks state,
 * handles failures, and skips stories whose dependencies failed.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Reuse pipeline-state for state management (dynamic import for cross-worktree compat)
// But implement inline to avoid dependency on other story branches

// ── computeCompletionSummary ──────────────────────────

/**
 * Compute summary stats from worker results.
 * @param {{name: string, exitCode: number, startedAt?: string, completedAt?: string}[]} results
 * @returns {{total: number, passed: number, failed: number, totalDurationMs: number}}
 */
export function computeCompletionSummary(results) {
  const total = results.length;
  const passed = results.filter((r) => r.exitCode === 0).length;
  const failed = total - passed;

  let totalDurationMs = 0;
  for (const r of results) {
    if (r.startedAt && r.completedAt) {
      totalDurationMs += new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime();
    }
  }

  return { total, passed, failed, totalDurationMs };
}

// ── executeSequentialPipeline ─────────────────────────

/**
 * Execute stories sequentially in dependency order.
 *
 * @param {{
 *   pipelineDir: string,
 *   pipelineId: string,
 *   stories: string[],
 *   artifactBaseDir: string,
 *   spawnWorker: (storyName: string) => Promise<{exitCode: number, events: object[], output: string, error: string}>,
 *   storyDeps: Object.<string, string[]>,
 *   updateStatus?: (pipelineDir: string, id: string, name: string, status: string) => Promise<void>,
 * }} opts
 * @returns {Promise<{name: string, exitCode: number, startedAt?: string, completedAt?: string}[]>}
 */
export async function executeSequentialPipeline({
  pipelineDir,
  pipelineId,
  stories,
  artifactBaseDir,
  spawnWorker,
  storyDeps,
  updateStatus,
}) {
  const results = [];
  const failedStories = new Set();

  for (const storyName of stories) {
    // Check if dependencies all passed
    const deps = storyDeps[storyName] || [];
    const blocked = deps.some((dep) => failedStories.has(dep));

    if (blocked) {
      results.push({
        name: storyName,
        exitCode: -1, // -1 = blocked/skipped
        startedAt: undefined,
        completedAt: undefined,
      });
      failedStories.add(storyName);
      continue;
    }

    const startedAt = new Date().toISOString();

    // Update status to active
    if (updateStatus) {
      await updateStatus(pipelineDir, pipelineId, storyName, "active");
    }

    // Spawn worker
    const artifactDir = join(artifactBaseDir, `STORY-${storyName}`);
    await mkdir(artifactDir, { recursive: true });

    const workerResult = await spawnWorker({ storyName });

    const completedAt = new Date().toISOString();

    // Determine final status
    const exitCode = workerResult.exitCode;
    const status = exitCode === 0 ? "done" : "failed";

    if (exitCode !== 0) {
      failedStories.add(storyName);
    }

    // Update status
    if (updateStatus) {
      await updateStatus(pipelineDir, pipelineId, storyName, status);
    }

    results.push({
      name: storyName,
      exitCode,
      startedAt,
      completedAt,
    });
  }

  return results;
}
