/**
 * Pipeline state management — create, read, update pipeline state files
 * and resolve story dependency graphs.
 *
 * State lives in `<vault>/Pipeline/PIPELINE-<id>.md` as human-readable Markdown.
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ── Types ─────────────────────────────────────────────

/** @typedef {{"name": string, "status": string, "startedAt"?: string, "completedAt"?: string}} PipelineStory */
/** @typedef {{"id": string, "mode": string, "createdAt": string, "stories": PipelineStory[]}} PipelineState */

const VALID_STATUSES = ["queued", "active", "done", "failed", "blocked"];

// ── generatePipelineId ────────────────────────────────

/**
 * Generate a unique pipeline ID from an epic name.
 * @param {string} epicName
 * @returns {string}
 */
export function generatePipelineId(epicName) {
  const slug = epicName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const uid = randomUUID().slice(0, 8);
  return `PIPELINE-${slug}-${uid}`;
}

// ── createPipelineState ───────────────────────────────

/**
 * Create a new pipeline state file.
 * @param {string} pipelineDir - Vault Pipeline directory
 * @param {{id: string, stories: string[], mode: string}} opts
 * @returns {Promise<string>} File path written
 */
export async function createPipelineState(pipelineDir, { id, stories, mode }) {
  await mkdir(pipelineDir, { recursive: true });

  const shortName = id.replace(/^PIPELINE-/, "");
  const createdAt = new Date().toISOString();

  const storyLines = stories
    .map(
      (name) =>
        `| ${name} | queued | — | — |`
    )
    .join("\n");

  const content = `# Pipeline: ${shortName}

\`\`\`yaml
id: ${id}
mode: ${mode}
created_at: ${createdAt}
\`\`\`

## Stories

| Name | Status | Started | Completed |
|------|--------|---------|-----------|
${storyLines}
`;

  const filePath = join(pipelineDir, `${id}.md`);
  await writeFile(filePath, content, "utf8");
  return filePath;
}

// ── readPipelineState ─────────────────────────────────

/**
 * Read and parse a pipeline state file.
 * @param {string} pipelineDir
 * @param {string} id
 * @returns {Promise<PipelineState>}
 */
export async function readPipelineState(pipelineDir, id) {
  const content = await readFile(join(pipelineDir, `${id}.md`), "utf8");
  return parsePipelineState(content);
}

/**
 * Parse pipeline state from markdown content.
 * @param {string} content
 * @returns {PipelineState}
 */
export function parsePipelineState(content) {
  // Extract YAML block
  const yamlMatch = content.match(/```yaml\n([\s\S]*?)```/);
  if (!yamlMatch) throw new Error("No YAML frontmatter in pipeline state");

  const yaml = yamlMatch[1];
  const idMatch = yaml.match(/id:\s*(.+)/);
  const modeMatch = yaml.match(/mode:\s*(.+)/);
  const createdAtMatch = yaml.match(/created_at:\s*(.+)/);

  if (!idMatch) throw new Error("Missing id in pipeline state");

  // Extract story table rows — split by lines, parse pipe-delimited columns
  const storyRows = [];
  const lines = content.split("\n");
  for (const line of lines) {
    // Match table rows: | value | value | value | value |
    const rowMatch = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/);
    if (!rowMatch) continue;
    const name = rowMatch[1].trim();
    // Skip header and separator rows
    if (name === "Name" || name.startsWith("---")) continue;
    storyRows.push({
      name,
      status: rowMatch[2].trim(),
      startedAt: rowMatch[3].trim() === "\u2014" ? undefined : rowMatch[3].trim(),
      completedAt: rowMatch[4].trim() === "\u2014" ? undefined : rowMatch[4].trim(),
    });
  }

  return {
    id: idMatch[1].trim(),
    mode: modeMatch ? modeMatch[1].trim() : "sequential",
    createdAt: createdAtMatch ? createdAtMatch[1].trim() : undefined,
    stories: storyRows,
  };
}

// ── updateStoryStatus ─────────────────────────────────

/**
 * Update a story's status in the pipeline state file.
 * Rewrites the entire file (atomic on most filesystems for small files).
 * @param {string} pipelineDir
 * @param {string} id
 * @param {string} storyName
 * @param {string} newStatus
 * @returns {Promise<void>}
 */
export async function updateStoryStatus(pipelineDir, id, storyName, newStatus) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const content = await readFile(join(pipelineDir, `${id}.md`), "utf8");
  const state = parsePipelineState(content);

  const story = state.stories.find((s) => s.name === storyName);
  if (!story) throw new Error(`Story "${storyName}" not found in pipeline ${id}`);

  const now = new Date().toISOString();
  story.status = newStatus;
  if (newStatus === "active" && !story.startedAt) {
    story.startedAt = now;
  }
  if (newStatus === "done" || newStatus === "failed") {
    story.completedAt = now;
  }

  // Rewrite the file
  const shortName = id.replace(/^PIPELINE-/, "");
  const storyLines = state.stories
    .map(
      (s) =>
        `| ${s.name} | ${s.status} | ${s.startedAt || "—"} | ${s.completedAt || "—"} |`
    )
    .join("\n");

  const updated = `# Pipeline: ${shortName}

\`\`\`yaml
id: ${state.id}
mode: ${state.mode}
created_at: ${state.createdAt}
\`\`\`

## Stories

| Name | Status | Started | Completed |
|------|--------|---------|-----------|
${storyLines}
`;

  await writeFile(join(pipelineDir, `${id}.md`), updated, "utf8");
}

// ── parseDependsOn ────────────────────────────────────

/**
 * Parse Depends-On from story markdown content.
 * Supports: YAML array `[a, b]`, single string `a`, or absent.
 * @param {string} storyContent
 * @returns {string[]}
 */
export function parseDependsOn(storyContent) {
  // Match frontmatter between --- delimiters
  const fmMatch = storyContent.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];

  const frontmatter = fmMatch[1];
  const depMatch = frontmatter.match(/Depends-On:\s*(.+)/i);
  if (!depMatch) return [];

  const raw = depMatch[1].trim();

  // Array format: [a, b, c]
  if (raw.startsWith("[")) {
    return raw
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Single value
  return [raw];
}

// ── buildDependencyGraph ──────────────────────────────

/**
 * Build a dependency graph and return stories in topological order.
 * Throws if circular dependencies are detected.
 * @param {{name: string, dependsOn: string[]}[]} stories
 * @returns {string[]} Story names in topological order
 */
export function buildDependencyGraph(stories) {
  const storyMap = new Map(stories.map((s) => [s.name, s]));

  // Kahn's algorithm
  const inDegree = new Map();
  const adj = new Map(); // name → names that depend on it

  for (const s of stories) {
    inDegree.set(s.name, 0);
    adj.set(s.name, []);
  }

  for (const s of stories) {
    for (const dep of s.dependsOn) {
      if (!storyMap.has(dep)) {
        throw new Error(`Unknown dependency: "${dep}" (referenced by "${s.name}")`);
      }
      adj.get(dep).push(s.name);
      inDegree.set(s.name, inDegree.get(s.name) + 1);
    }
  }

  // Self-dependency check
  for (const s of stories) {
    if (s.dependsOn.includes(s.name)) {
      throw new Error(`Circular dependency detected: ${s.name} depends on itself`);
    }
  }

  const queue = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const order = [];
  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current);

    for (const dependent of adj.get(current)) {
      inDegree.set(dependent, inDegree.get(dependent) - 1);
      if (inDegree.get(dependent) === 0) {
        queue.push(dependent);
      }
    }
  }

  if (order.length !== stories.length) {
    // Find the cycle for the error message
    const remaining = stories.filter((s) => !order.includes(s.name)).map((s) => s.name);
    throw new Error(
      `Circular dependency detected among: ${remaining.join(" → ")}`
    );
  }

  return order;
}

// ── getReadyStories ───────────────────────────────────

/**
 * Return stories that are ready to be picked up:
 * - Status is "queued"
 * - All dependencies have status "done"
 * @param {PipelineStory[]} stories
 * @param {Object.<string, string[]>} depsMap - story name → dependency names
 * @returns {PipelineStory[]}
 */
export function getReadyStories(stories, depsMap) {
  const doneNames = new Set(
    stories.filter((s) => s.status === "done").map((s) => s.name)
  );

  return stories.filter((s) => {
    if (s.status !== "queued") return false;
    const deps = depsMap[s.name] || [];
    return deps.every((d) => doneNames.has(d));
  });
}
