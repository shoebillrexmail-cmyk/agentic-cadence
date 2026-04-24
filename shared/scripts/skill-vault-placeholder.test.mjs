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
    // Sort the skill list before iterating so the offenders list (and any
    // resulting error message) is deterministic across filesystems —
    // `readdirSync` order is not guaranteed by POSIX.
    const allSkills = readdirSync(CLAUDE_SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
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

describe("Pi ↔ Claude placeholder-convention parity", () => {
  // Convention — not exact-shape — parity: Claude skills may legitimately
  // reference vault-level paths Pi doesn't (e.g. `_Dashboard.md` is a Claude-
  // specific step). What MUST match is the convention: angle-bracketed token,
  // forward-slash separators, and the placeholder always followed by `/`.
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

  test("every <Obsidian_Vaults> occurrence in Claude is followed by a forward slash", () => {
    for (const name of AFFECTED_SKILLS) {
      const body = readSkill(CLAUDE_SKILLS_DIR, name);
      // Find each placeholder, record what follows immediately.
      const re = /<Obsidian_Vaults>(.)/gs;
      let match;
      const bad = [];
      while ((match = re.exec(body)) !== null) {
        if (match[1] !== "/") bad.push(JSON.stringify(match[0]));
      }
      assert.deepEqual(
        bad,
        [],
        `${name}/SKILL.md has <Obsidian_Vaults> occurrences not followed by "/": ${bad.join(
          ", ",
        )}. The placeholder must always be followed by a forward slash.`,
      );
    }
  });

  test("no malformed placeholder variants (spaces, wrong case, missing brackets)", () => {
    const malformed = [
      /<Obsidian Vaults>/i,
      /< Obsidian_Vaults>/,
      /<Obsidian_Vaults >/,
      /<obsidian_vaults>/, // wrong case — exclude the canonical form
    ];
    for (const name of AFFECTED_SKILLS) {
      const body = readSkill(CLAUDE_SKILLS_DIR, name);
      for (const re of malformed) {
        // Skip the canonical <Obsidian_Vaults> form — /<obsidian_vaults>/ is case-sensitive
        // by default, so it catches only lowercase variants.
        assert.equal(
          re.test(body),
          false,
          `${name}/SKILL.md contains malformed placeholder matching ${re}. Canonical form is <Obsidian_Vaults>.`,
        );
      }
    }
  });
});
