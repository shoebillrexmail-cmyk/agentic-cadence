#!/usr/bin/env node

/**
 * Build script for agentic-cadence monorepo.
 *
 * Assembles agent-specific rules/prompts from shared conventions + package fragments.
 *
 * Usage:
 *   node shared/build.mjs          # build all packages
 *   node shared/build.mjs claude   # build Claude package only
 *   node shared/build.mjs pi       # build Pi package only
 *   node shared/build.mjs domain   # validate domain packages only
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function load(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
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

  // Write outputs
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
