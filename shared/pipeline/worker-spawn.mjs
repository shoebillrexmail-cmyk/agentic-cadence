/**
 * Worker spawning and lifecycle management for the cadence pipeline.
 *
 * Spawns Pi subprocess workers using `--mode json -p` for one-shot execution.
 * Each worker runs in its own git worktree and executes the full cadence
 * lifecycle: pickup -> implement -> review -> done -> learn.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { platform } from "node:os";
import { spawn, execSync } from "node:child_process";

// ── buildWorkerPrompt ─────────────────────────────────

/**
 * Build a comprehensive prompt that drives the cadence lifecycle for a worker.
 * @param {{name: string, content: string}} story
 * @returns {string}
 */
export function buildWorkerPrompt(story) {
  return `You are a cadence pipeline worker executing STORY-${story.name}.

## Your Role
You are an autonomous agent executing a single story through the full cadence lifecycle.
You must follow TDD discipline and the cadence flow precisely.

## CRITICAL RULES
1. Do NOT spawn sub-processes or sub-agents — you are a leaf worker
2. Follow TDD: write tests FIRST (RED), implement (GREEN), refactor (IMPROVE)
3. Commit frequently with semantic messages
4. Push your branch when done
5. Report clear status at the end

## Execution Flow
1. Read the story file and understand acceptance criteria
2. Set up test infrastructure if needed
3. RED phase: Write failing tests for each acceptance criterion
4. GREEN phase: Implement minimum code to pass all tests
5. IMPROVE phase: Refactor, ensure 80%+ coverage
6. Run full review: check code quality, security, performance
7. Create PR if all tests pass
8. Summarize what was done

## Story Content
${story.content}

## Exit Protocol
When done, output a summary:
\`\`\`
## STORY-${story.name} — Complete
- Tests: X passing, X total
- Coverage: X%
- PR: (url or "N/A")
- Status: SUCCESS | PARTIAL | FAILED
- Notes: (any issues encountered)
\`\`\`
`;
}

// ── buildWorkerArgs ────────────────────────────────────

/**
 * Assemble CLI arguments for spawning a Pi worker subprocess.
 * @param {{cwd: string, model?: string, thinking?: string, promptFile: string}} opts
 * @returns {string[]}
 */
export function buildWorkerArgs({ cwd, model, thinking, promptFile }) {
  const args = ["--mode", "json", "-p", `@${promptFile}`, "--cwd", cwd];

  if (model) {
    args.push("--model", model);
  }
  if (thinking) {
    args.push("--thinking", thinking);
  }

  return args;
}

// ── parseJsonEvent ─────────────────────────────────────

/**
 * Parse a single JSON event line from Pi's stdout.
 * @param {string} line
 * @returns {object|null}
 */
export function parseJsonEvent(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// ── resolveModelFlags ──────────────────────────────────

/**
 * Resolve model configuration from pipeline settings.
 * @param {{worker_model?: string, worker_thinking?: string, fallback_models?: string}} config
 * @returns {{model?: string, thinking?: string, fallbacks?: string[]}}
 */
export function resolveModelFlags(config) {
  const result = {};

  if (config.worker_model) {
    result.model = config.worker_model;
  }
  if (config.worker_thinking) {
    result.thinking = config.worker_thinking;
  }
  if (config.fallback_models) {
    result.fallbacks = config.fallback_models.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return result;
}

// ── writeArtifacts ─────────────────────────────────────

/**
 * Write worker execution artifacts to the vault.
 * @param {string} dir - Artifact directory
 * @param {{input: string, output: string, events: object[], meta: object}} artifacts
 */
export async function writeArtifacts(dir, { input, output, events, meta }) {
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, "input.md"), input, "utf8");
  await writeFile(join(dir, "output.md"), output, "utf8");

  // Write events as JSONL
  const jsonl = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(join(dir, "events.jsonl"), jsonl, "utf8");

  // Write metadata
  await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
}

// ── resolvePiCommand ───────────────────────────────────

/**
 * Resolve the Pi CLI command for the current platform.
 * On Windows, `pi` is a batch wrapper — resolve to the node script directly.
 * @returns {string}
 */
export function resolvePiCommand() {
  if (platform() === "win32") {
    try {
      const which = execSync("where pi", { encoding: "utf8" }).trim().split("\n")[0];
      if (which.endsWith(".cmd")) {
        return "pi";
      }
      return which;
    } catch {
      return "pi";
    }
  }
  return "pi";
}

// ── spawnWorker ────────────────────────────────────────

/**
 * Spawn a Pi worker subprocess for a story.
 * @param {{
 *   storyName: string,
 *   worktreePath: string,
 *   model?: string,
 *   thinking?: string,
 *   pipelineId: string,
 *   artifactDir: string,
 *   drainTimeoutMs?: number
 * }} opts
 * @returns {Promise<{exitCode: number, events: object[], output: string, error: string}>}
 */
export function spawnWorker({
  storyName,
  storyContent,
  worktreePath,
  model,
  thinking,
  pipelineId,
  artifactDir,
  drainTimeoutMs = 30000,
}) {
  return new Promise(async (resolve, reject) => {
    // Write prompt to temp file
    const promptFile = join(artifactDir, "input.md");
    const story = { name: storyName, content: storyContent || `Story: ${storyName}` };
    const prompt = buildWorkerPrompt(story);
    await mkdir(artifactDir, { recursive: true });
    await writeFile(promptFile, prompt, "utf8");

    // Build CLI args
    const args = buildWorkerArgs({
      cwd: worktreePath,
      model,
      thinking,
      promptFile,
    });

    const command = resolvePiCommand();

    const env = {
      ...process.env,
      PI_SUBAGENT_MAX_DEPTH: "1",
    };

    const child = spawn(command, args, {
      cwd: worktreePath,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: platform() === "win32",
    });

    const events = [];
    let output = "";
    let errorOutput = "";
    let drainTimer = null;
    let lastActivity = Date.now();

    // Parse stdout line-by-line
    let stdoutBuffer = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      stdoutBuffer += text;
      lastActivity = Date.now();

      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop(); // Keep incomplete line

      for (const line of lines) {
        const event = parseJsonEvent(line);
        if (event) {
          events.push(event);
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });

    child.on("close", (code) => {
      if (drainTimer) clearTimeout(drainTimer);

      // Parse any remaining buffer
      if (stdoutBuffer.trim()) {
        const event = parseJsonEvent(stdoutBuffer);
        if (event) events.push(event);
      }

      resolve({
        exitCode: code ?? 1,
        events,
        output,
        error: errorOutput,
      });
    });

    child.on("error", (err) => {
      if (drainTimer) clearTimeout(drainTimer);
      resolve({
        exitCode: 1,
        events,
        output,
        error: err.message,
      });
    });

    // Drain timeout: if no activity for too long after last event, force kill
    drainTimer = setTimeout(() => {
      if (Date.now() - lastActivity > drainTimeoutMs) {
        child.kill("SIGTERM");
        resolve({
          exitCode: 1,
          events,
          output,
          error: `Worker timed out after ${drainTimeoutMs}ms of inactivity`,
        });
      }
    }, drainTimeoutMs);
  });
}
