#!/usr/bin/env node

/**
 * Build script for agentic-cadence monorepo.
 *
 * Assembles agent-specific rules/prompts from shared conventions + package fragments.
 * Also wraps shared/agents/ prompt bodies with runtime-specific frontmatter.
 *
 * Usage:
 *   node shared/build.mjs          # build all packages
 *   node shared/build.mjs claude   # build Claude package only
 *   node shared/build.mjs pi       # build Pi package only
 *   node shared/build.mjs domain   # validate domain packages only
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function load(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

/**
 * Read all shared agent source files (excluding _template.md and other underscore-prefixed
 * internal files). Returns array of { name, body, description } where description is the
 * first line of the body.
 */
function readSharedAgents() {
  const agentsDir = resolve(ROOT, "shared/agents");
  if (!existsSync(agentsDir)) return [];

  return readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => {
      const body = readFileSync(resolve(agentsDir, f), "utf8").trim();
      const name = basename(f, ".md");

      // First non-empty line of body = description (for tool-selection prompt)
      const firstLine = body.split("\n").find((l) => l.trim().length > 0) || name;

      return { name, body, description: firstLine.trim() };
    });
}

/**
 * Skills that invoke `parse-cadence-config.mjs` from their Bash step.
 * The script is copied into each skill directory so the SKILL.md can reference
 * it via Claude's `${CLAUDE_SKILL_DIR}` env var or Pi's `{baseDir}` placeholder —
 * both of which resolve to the skill's own install directory, not the user's cwd.
 */
const SKILLS_USING_PARSER = {
  claude: ["cadence-interview", "cadence-pickup", "cadence-review", "cadence-story"],
  pi: ["cadence-interview", "cadence-pickup", "cadence-release", "cadence-review", "cadence-story"],
};

/**
 * Copy the canonical parser script into each skill directory that needs it.
 * Source of truth: shared/scripts/parse-cadence-config.mjs
 */
function copyParserToSkills(skillRoot, skillNames) {
  const src = resolve(ROOT, "shared/scripts/parse-cadence-config.mjs");
  if (!existsSync(src)) {
    console.log(`   ⚠️  Parser source missing: ${src}`);
    return 0;
  }
  let copied = 0;
  for (const name of skillNames) {
    const skillDir = resolve(ROOT, skillRoot, name);
    if (!existsSync(skillDir)) {
      console.log(`   ⚠️  Skill dir missing, skipped: ${skillRoot}/${name}`);
      continue;
    }
    const dest = resolve(skillDir, "parse-cadence-config.mjs");
    copyFileSync(src, dest);
    copied++;
  }
  return copied;
}

/**
 * Default tool allowlist per agent.
 * Most shared agents are READ-ONLY analysts — only cadence-pm writes vault files.
 */
function toolsFor(agentName) {
  if (agentName === "cadence-pm") {
    return ["Read", "Write", "Edit", "Glob", "Grep", "Bash"];
  }
  return ["Read", "Glob", "Grep"];
}

/**
 * Model tier per agent — assigned by reasoning depth × downstream impact.
 *
 * Opus (8):    deep reasoning + high-leverage decisions
 *              (gates, foundational specs, binding rulings, stuck recovery)
 * Sonnet (7):  balanced reasoning, local impact (default tier)
 * Haiku (4):   mechanical bookkeeping / aggregation / structured eliciting
 *
 * See STORY-agent-model-tiers for the full rationale per agent.
 */
function modelFor(agentName) {
  const opusAgents = new Set([
    "ontologist",          // gates whether story is even the right problem
    "seed-architect",      // produces structured spec every later agent consumes
    "ontology-analyst",    // formal domain modeling; errors propagate
    "contrarian",          // adversarial assumption inversion
    "semantic-evaluator",  // goal-alignment + drift scoring (intent vs code)
    "advocate",            // honest steel-manning for consensus
    "judge",               // binding final arbitration
    "hacker",              // creative constraint-breaking when stuck
  ]);

  const haikuAgents = new Set([
    "socratic-interviewer", // one question per round
    "breadth-keeper",       // track-list bookkeeping
    "seed-closer",          // 7-criterion closure checklist
    "evaluator",            // pure aggregator of stage outputs → verdict
  ]);

  if (opusAgents.has(agentName)) return "opus";
  if (haikuAgents.has(agentName)) return "haiku";
  return "sonnet";
}

/**
 * YAML-safe double-quoted scalar. Escapes backslashes and quotes; collapses
 * newlines so the description stays a single line. Any first-line text
 * containing `:`, `|`, `>`, leading indicators, or quotes becomes safe here.
 */
function yamlQuote(s) {
  const collapsed = String(s).replace(/\r?\n/g, " ").trim();
  const escaped = collapsed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Wrap a shared agent body with Claude subagent YAML frontmatter.
 */
function wrapClaudeAgent(agent) {
  const tools = toolsFor(agent.name);
  const model = modelFor(agent.name);

  const frontmatter = [
    "---",
    `name: ${agent.name}`,
    `description: ${yamlQuote(agent.description)}`,
    `model: ${model}`,
    "tools:",
    ...tools.map((t) => `  - ${t}`),
    "---",
    "",
  ].join("\n");

  return frontmatter + agent.body + "\n";
}

function buildClaude() {
  console.log("📦 Building Claude Code package...");

  const header = load("packages/claude/build/header.md");
  const core = load("shared/core.md");
  const worktreeRule = load("packages/claude/build/worktree-rule.md");
  const agentWorkflow = load("packages/claude/build/agent-workflow.md");
  const gitWorkflowAddon = load("packages/claude/build/git-worktree-addon.md");

  // Extract git-related sections from core for the separate git-workflow rule
  const gitWorkflowRule = `# Git Workflow

${core.split("## Git Workflow")[1]?.split("## Multi-Project Rules")[0] || ""}
${gitWorkflowAddon}
`;

  // Assemble obsidian-workflow.md
  // Remove the Git Workflow section from core (it's a separate file for Claude)
  const coreWithoutGit = core.replace(
    /## Git Workflow[\s\S]*?(?=## Multi-Project Rules)/,
    ""
  );

  const obsidianWorkflow = `${header}
${coreWithoutGit}
${worktreeRule}
${agentWorkflow}

---

## Git Integration Summary

See \`git-workflow.md\` for full branching strategy, worktree usage, and release flow.

| Agile Event | Git Action |
|-------------|-----------|
| Story pulled into sprint | Branch \`feature/STORY-<name>\` created from \`develop\` |
| Story picked up (In Progress) | Checkout / worktree on that branch |
| Story completed (In Review) | Push branch, create PR → \`develop\` |
| Story accepted (Done) | PR merged, branch deleted, worktree removed |
| Release started | Branch \`release/vX.Y.Z\` cut from \`develop\` |
| Hotfix | Branch from \`master\`, PR → \`master\` + \`develop\` |
`;

  // Write rule outputs
  const rulesDir = resolve(ROOT, "packages/claude/rules");
  mkdirSync(rulesDir, { recursive: true });

  writeFileSync(
    resolve(rulesDir, "obsidian-workflow.md"),
    obsidianWorkflow.trim() + "\n"
  );
  writeFileSync(
    resolve(rulesDir, "git-workflow.md"),
    gitWorkflowRule.trim() + "\n"
  );

  console.log("   ✅ packages/claude/rules/obsidian-workflow.md");
  console.log("   ✅ packages/claude/rules/git-workflow.md");

  // Wrap shared/agents/ bodies with Claude subagent frontmatter → packages/claude/agents/
  //
  // IMPORTANT: this directory is GENERATED. `rmSync` below wipes it clean every
  // build so stale shared agents don't linger. Do NOT hand-author files here —
  // any hand-authored .md will be destroyed on the next build. Author in
  // shared/agents/<name>.md and run `npm run build`.
  const agentsOutDir = resolve(ROOT, "packages/claude/agents");

  if (existsSync(agentsOutDir)) {
    rmSync(agentsOutDir, { recursive: true, force: true });
  }
  mkdirSync(agentsOutDir, { recursive: true });

  const agents = readSharedAgents();
  for (const agent of agents) {
    const wrapped = wrapClaudeAgent(agent);
    writeFileSync(resolve(agentsOutDir, `${agent.name}.md`), wrapped);
    console.log(`   ✅ packages/claude/agents/${agent.name}.md`);
  }

  console.log(`   → ${agents.length} shared agents emitted`);

  const copied = copyParserToSkills("packages/claude/skills", SKILLS_USING_PARSER.claude);
  console.log(`   → parser copied to ${copied} Claude skills`);
}

/**
 * For Pi, inline the shared agent bodies into a single reference prompt.
 * Pi has no subagent runtime — skills that "invoke" an agent quote its body inline,
 * or reference this consolidated file for the full role definition.
 */
function buildPiAgentReference(agents) {
  const header = `# Shared Agent Role Definitions

This file is auto-generated from \`shared/agents/*.md\`.

Pi has no subagent runtime, so cadence skills that reference these agents role-play them inline.
This file is the single source of truth for those role prompts — skills may inline the body
or reference this file by agent name.

DO NOT EDIT DIRECTLY. Edit \`shared/agents/<name>.md\` and run \`npm run build:pi\`.

---
`;

  const bodies = agents
    .map(
      (a) =>
        `\n## Agent: ${a.name}\n\n_${a.description}_\n\n${a.body
          .split("\n")
          .slice(1) // drop first line (it's the description we already rendered above)
          .join("\n")
          .trim()}\n`
    )
    .join("\n---\n");

  return header + bodies;
}

function buildPi() {
  console.log("📦 Building Pi package...");

  const header = load("packages/pi/build/header.md");
  const core = load("shared/core.md");

  // For Pi, git workflow is included inline (single prompt)
  const agileWorkflow = `${header}
${core}
`;

  // Write output
  const promptsDir = resolve(ROOT, "packages/pi/.pi/prompts");
  mkdirSync(promptsDir, { recursive: true });

  writeFileSync(
    resolve(promptsDir, "agile-workflow.md"),
    agileWorkflow.trim() + "\n"
  );

  console.log("   ✅ packages/pi/.pi/prompts/agile-workflow.md");

  // Consolidated shared agent reference for Pi skills to inline from
  const agents = readSharedAgents();
  if (agents.length > 0) {
    const reference = buildPiAgentReference(agents);
    writeFileSync(
      resolve(promptsDir, "shared-agents.md"),
      reference.trim() + "\n"
    );
    console.log(
      `   ✅ packages/pi/.pi/prompts/shared-agents.md (${agents.length} roles)`
    );
  }

  const copied = copyParserToSkills("packages/pi/.pi/skills", SKILLS_USING_PARSER.pi);
  console.log(`   → parser copied to ${copied} Pi skills`);
}

function buildDomain() {
  console.log("📦 Validating domain packages...");

  const domainDir = resolve(ROOT, "packages/domain");

  if (!existsSync(domainDir)) {
    console.log("   ⚠️  No domain packages found (packages/domain/)");
    return;
  }

  const domains = readdirSync(domainDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const domain of domains) {
    const domainPath = resolve(domainDir, domain);
    const specialistsPath = resolve(domainPath, "specialists.md");
    const agentsDir = resolve(domainPath, "agents");
    const knowledgeDir = resolve(domainPath, "knowledge");
    const skillsDir = resolve(domainPath, "skills");

    // Validate specialists.md exists
    if (!existsSync(specialistsPath)) {
      console.log(`   ❌ ${domain}/specialists.md missing`);
      continue;
    }

    // Count agents
    let agentCount = 0;
    if (existsSync(agentsDir)) {
      agentCount = readdirSync(agentsDir).filter((f) => f.endsWith(".md")).length;
    }

    // Count knowledge slices
    let sliceCount = 0;
    const slicesDir = resolve(knowledgeDir, "slices");
    if (existsSync(slicesDir)) {
      sliceCount = readdirSync(slicesDir).filter((f) => f.endsWith(".md")).length;
    }

    // Count skills
    let skillCount = 0;
    if (existsSync(skillsDir)) {
      skillCount = readdirSync(skillsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .length;
    }

    console.log(
      `   ✅ ${domain}: ${agentCount} agents, ${sliceCount} knowledge slices, ${skillCount} skills`
    );
  }
}

// Main
const targets = process.argv.slice(2);

if (targets.length === 0 || targets.includes("claude")) {
  buildClaude();
}

if (targets.length === 0 || targets.includes("pi")) {
  buildPi();
}

if (targets.length === 0 || targets.includes("domain")) {
  buildDomain();
}

console.log("\n✨ Build complete. Generated files are ready.");
