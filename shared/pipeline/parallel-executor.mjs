/**
 * Parallel pipeline executor — spawns multiple workers concurrently with bounded concurrency.
 *
 * Dynamically schedules stories as their dependencies are satisfied.
 * Respects maxConcurrency limit. Serializes PR merges to develop branch.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// ── serializeMerges ───────────────────────────────────

/**
 * Execute async functions one at a time (FIFO merge queue).
 * @param {(() => Promise<void>)[]} fns
 */
export async function serializeMerges(fns) {
  for (const fn of fns) {
    await fn();
  }
}

// ── executeParallelPipeline ───────────────────────────

/**
 * Execute stories in parallel with bounded concurrency.
 * Re-evaluates ready stories after each worker completes.
 *
 * @param {{
 *   pipelineDir: string,
 *   pipelineId: string,
 *   stories: string[],
 *   artifactBaseDir: string,
 *   spawnWorker: (storyName: string) => Promise<{exitCode: number, events: object[], output: string, error: string}>,
 *   storyDeps: Object.<string, string[]>,
 *   maxConcurrency?: number,
 * }} opts
 * @returns {Promise<{name: string, exitCode: number, startedAt?: string, completedAt?: string}[]>}
 */
export async function executeParallelPipeline({
  stories,
  artifactBaseDir,
  spawnWorker,
  storyDeps,
  maxConcurrency = 3,
  updateStatus,
  pipelineDir,
  pipelineId,
}) {
  const results = [];
  const completed = new Set();
  const failed = new Set();
  const inFlight = new Set();
  const mergeQueue = [];

  let pending = [...stories];

  async function runWorker(storyName) {
    const startedAt = new Date().toISOString();
    const artifactDir = join(artifactBaseDir, `STORY-${storyName}`);
    await mkdir(artifactDir, { recursive: true });

    if (updateStatus) {
      await updateStatus(pipelineDir, pipelineId, storyName, "active").catch(() => {});
    }

    const result = await spawnWorker(storyName);
    const completedAt = new Date().toISOString();

    const exitCode = result.exitCode;
    if (exitCode === 0) {
      completed.add(storyName);
      mergeQueue.push(async () => {
        // Placeholder for actual merge logic
      });
    } else {
      failed.add(storyName);
    }

    if (updateStatus) {
      await updateStatus(pipelineDir, pipelineId, storyName, exitCode === 0 ? "done" : "failed").catch(() => {});
    }

    results.push({ name: storyName, exitCode, startedAt, completedAt });
    inFlight.delete(storyName);
  }

  // Main scheduling loop
  while (pending.length > 0 || inFlight.size > 0) {
    // Find stories ready to start
    const ready = pending.filter((name) => {
      const deps = storyDeps[name] || [];
      return deps.every((d) => completed.has(d)) && !failed.has(name);
    });

    // Also handle stories whose deps include failed stories -> skip them
    const blocked = pending.filter((name) => {
      const deps = storyDeps[name] || [];
      return deps.some((dep) => failed.has(dep));
    });

    // Mark blocked stories
    for (const name of blocked) {
      results.push({ name, exitCode: -1 });
      failed.add(name);
      pending = pending.filter((n) => n !== name);
    }

    // Launch workers up to concurrency limit
    const toLaunch = ready.slice(0, maxConcurrency - inFlight.size);
    for (const name of toLaunch) {
      inFlight.add(name);
      pending = pending.filter((n) => n !== name);
      // Don't await — fire and track
      runWorker(name);
    }

    // Wait for at least one NEW worker to complete
    if (inFlight.size > 0) {
      const prevCount = results.length;
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (inFlight.size === 0 || results.length > prevCount) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
    }

    // If nothing launched and nothing in flight, we're stuck -> break
    if (toLaunch.length === 0 && inFlight.size === 0) break;
  }

  // Process merge queue serially
  await serializeMerges(mergeQueue);

  return results;
}
