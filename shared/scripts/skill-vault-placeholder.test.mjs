#!/usr/bin/env node
/**
 * Tests for STORY-claude-skill-vault-placeholder.
 *
 * Asserts that the 5 Claude SKILL.md files use the <Obsidian_Vaults> placeholder
 * convention (already used by Pi + shared/core.md) instead of the hardcoded
 * `C:\Obsidian_Vaults` literal.
 *
 * Run: node --test shared/scripts/skill-vault-placeholder.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const CLAUDE_SKILLS_DIR = resolve(REPO_ROOT, "packages/claude/skills");
const PI_SKILLS_DIR = resolve(REPO_ROOT, "packages/pi/.pi/skills");

const AFFECTED_SKILLS = [
  "cadence-init",
  "cadence-sync",
  "cadence-pickup",
  "cadence-learn",
  "cadence-done",
];

const MIN_PLACEHOLDER_COUNT = {
  "cadence-init": 7,
  "cadence-sync": 1,
  "cadence-pickup": 1,
  "cadence-learn": 2,
  "cadence-done": 1,
};

const HARDCODED_LITERAL = "C:\\Obsidian_Vaults";
const PLACEHOLDER = "<Obsidian_Vaults>";

function readSkill(runtimeDir, name) {
  return readFileSync(resolve(runtimeDir, name, "SKILL.md"), "utf8");
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

/**
 * Extract normalized placeholder "shapes" from a skill body.
 * A shape is the prefix after <Obsidian_Vaults> up to the first whitespace, backtick,
 * quote, parenthesis, comma, or end-of-line. Used for Pi-parity checks.
 */
function extractPlaceholderShapes(body) {
  const shapes = new Set();
  const re = /<Obsidian_Vaults>[^\s)`'",]*/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    shapes.add(match[0]);
  }
  return shapes;
}

describe("Claude SKILL.md literal removal", () => {
  for (const name of AFFECTED_SKILLS) {
    test(`${name}/SKILL.md contains no hardcoded C:\\Obsidian_Vaults`, () => {
      const body = readSkill(CLAUDE_SKILLS_DIR, name);
      assert.equal(
        body.includes(HARDCODED_LITERAL),
        false,
        `${name}/SKILL.md still contains the literal "${HARDCODED_LITERAL}". ` +
          `Replace it with "${PLACEHOLDER}".`,
      );
    });
  }

  test("no other Claude SKILL.md contains the literal either", () => {
    const allSkills = readdirSync(CLAUDE_SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const offenders = [];
    for (const name of allSkills) {
      try {
        const body = readSkill(CLAUDE_SKILLS_DIR, name);
        if (body.includes(HARDCODED_LITERAL)) offenders.push(name);
      } catch {
        // no SKILL.md; skip
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Unexpected SKILL.md files still contain "${HARDCODED_LITERAL}": ${offenders.join(", ")}`,
    );
  });
});

describe("Claude SKILL.md placeholder presence", () => {
  for (const [name, minCount] of Object.entries(MIN_PLACEHOLDER_COUNT)) {
    test(`${name}/SKILL.md contains >=${minCount} occurrence(s) of ${PLACEHOLDER}`, () => {
      const body = readSkill(CLAUDE_SKILLS_DIR, name);
      const actual = countOccurrences(body, PLACEHOLDER);
      assert.ok(
        actual >= minCount,
        `${name}/SKILL.md has ${actual} occurrence(s) of "${PLACEHOLDER}"; ` +
          `expected at least ${minCount}. Every removed literal must be replaced.`,
      );
    });
  }

  test("cadence-learn/SKILL.md references <Obsidian_Vaults>/_Knowledge (vault-level scope)", () => {
    const body = readSkill(CLAUDE_SKILLS_DIR, "cadence-learn");
    assert.ok(
      body.includes("<Obsidian_Vaults>/_Knowledge"),
      "cadence-learn/SKILL.md must reference the shared knowledge base via `<Obsidian_Vaults>/_Knowledge` (vault-level, never project-scoped).",
    );
  });
});

describe("Pi ↔ Claude placeholder-shape parity", () => {
  test("every Claude placeholder shape is also used by at least one Pi skill", () => {
    // Collect all Pi shapes across every Pi skill.
    const piSkills = readdirSync(PI_SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const piShapes = new Set();
    for (const name of piSkills) {
      try {
        const body = readSkill(PI_SKILLS_DIR, name);
        for (const s of extractPlaceholderShapes(body)) piShapes.add(s);
      } catch {
        // skip
      }
    }

    // Assemble all Claude shapes from the 5 affected skills.
    const claudeShapes = new Set();
    for (const name of AFFECTED_SKILLS) {
      const body = readSkill(CLAUDE_SKILLS_DIR, name);
      for (const s of extractPlaceholderShapes(body)) claudeShapes.add(s);
    }

    // Pi must know every shape Claude uses. Novel Claude-only shapes are a regression.
    const novel = [...claudeShapes].filter((s) => !piShapes.has(s));
    assert.deepEqual(
      novel,
      [],
      `Claude SKILL.md files introduce placeholder shapes not used by any Pi skill: ${novel.join(
        ", ",
      )}. Add the shape to a Pi skill first, or rewrite the Claude occurrence to an existing Pi shape.`,
    );
  });

  test("Claude placeholders never use Windows-style backslashes", () => {
    const re = /<Obsidian_Vaults>\\/;
    for (const name of AFFECTED_SKILLS) {
      const body = readSkill(CLAUDE_SKILLS_DIR, name);
      assert.equal(
        re.test(body),
        false,
        `${name}/SKILL.md contains a Windows-style backslash after <Obsidian_Vaults>. Use forward slashes to match Pi + shared/core.md conventions.`,
      );
    }
  });
});
