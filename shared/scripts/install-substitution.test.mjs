#!/usr/bin/env node
/**
 * Integration tests for STORY-claude-skill-vault-placeholder.
 *
 * Exercises the mechanism `<Obsidian_Vaults>` placeholders in Claude SKILL.md
 * files rely on at runtime: the installer's `sed` substitution rewrites
 * `obsidian-workflow.md` with the user's chosen vault path, and that
 * installed rule file becomes the authoritative source the agent reads
 * alongside any SKILL.md containing the placeholder.
 *
 * These tests run `install.sh` against a sandboxed `$HOME`, then verify:
 *
 *   1. The installed `obsidian-workflow.md` contains the custom vault path
 *      and does not contain the installer default.
 *   2. End-to-end consistency: the SKILL.md files shipped by the plugin
 *      still reference the `<Obsidian_Vaults>` placeholder (never the
 *      literal `C:\Obsidian_Vaults`), so an agent reading both files at
 *      runtime would resolve every placeholder against the installer-
 *      rewritten path. This is the automated proxy for the manual smoke
 *      procedure in `tests/smoke-placeholder-resolution.md`.
 *
 * Uses POSIX forward-slash paths derived from `os.tmpdir()`. The installer
 * has a pre-existing, out-of-scope issue where `sed`'s replacement string
 * mangles Windows-style backslashes — tracked in a separate story. Forward-
 * slash paths work under Linux, macOS, and Git Bash / MSYS on Windows.
 *
 * Skipped automatically when `bash` is not available on PATH.
 *
 * Run: node --test shared/scripts/install-substitution.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const INSTALL_SH = resolve(REPO_ROOT, "packages/claude/install.sh");
const CLAUDE_SKILLS_DIR = resolve(REPO_ROOT, "packages/claude/skills");

function hasBash() {
  const res = spawnSync("bash", ["--version"], { encoding: "utf8" });
  return res?.status === 0;
}

/** Convert a native path to forward-slash form. Git Bash / MSYS accepts
 *  these via its POSIX-path emulation, and sed's replacement string does
 *  not treat `/` as special. */
function toPosix(p) {
  return p.replace(/\\/g, "/");
}

/** Set up a sandbox HOME + custom vault path and run install.sh against
 *  them. Returns { sandbox, fakeHome, customVault, spawnResult } — the
 *  caller is responsible for `rmSync(sandbox)` cleanup. */
function runInstallerInSandbox() {
  const sandbox = mkdtempSync(join(tmpdir(), "cadence-install-"));
  const fakeHome = toPosix(join(sandbox, "home"));
  const customVault = toPosix(join(sandbox, "CustomVault"));

  // Pre-create $HOME so the installer never relies on implicit mkdir-on-write
  // through nested `mkdir -p` calls. Decouples the test from installer
  // implementation details.
  mkdirSync(fakeHome, { recursive: true });

  const spawnResult = spawnSync("bash", [INSTALL_SH], {
    // install.sh is interactive: pipe "" (accepts the default vault prompt
    // since OBSIDIAN_VAULT_PATH is already set) then "Y" (accepts the
    // create-vault-directory prompt).
    input: "\nY\n",
    env: {
      ...process.env,
      HOME: fakeHome,
      OBSIDIAN_VAULT_PATH: customVault,
    },
    encoding: "utf8",
    timeout: 30_000,
  });

  return { sandbox, fakeHome, customVault, spawnResult };
}

describe("install.sh sed-substitution + SKILL.md placeholder end-to-end", () => {
  test(
    "obsidian-workflow.md is rewritten with the custom vault path, and SKILL.md files retain the <Obsidian_Vaults> placeholder (end-to-end consistency)",
    { skip: hasBash() ? false : "bash not available on PATH" },
    () => {
      const { sandbox, fakeHome, customVault, spawnResult } =
        runInstallerInSandbox();

      try {
        // --- 1. Installer ran successfully. ---
        assert.equal(
          spawnResult.status,
          0,
          `install.sh exited ${spawnResult.status}.\nstdout:\n${spawnResult.stdout}\nstderr:\n${spawnResult.stderr}`,
        );

        // --- 2. Installed rule file carries the custom path. ---
        const installedRule = join(
          fakeHome,
          ".claude",
          "rules",
          "common",
          "obsidian-workflow.md",
        );
        assert.ok(
          existsSync(installedRule),
          `Expected installed rule at ${installedRule}. stdout:\n${spawnResult.stdout}`,
        );

        const ruleBody = readFileSync(installedRule, "utf8");

        assert.ok(
          ruleBody.includes(customVault),
          `Installed obsidian-workflow.md does NOT contain the custom vault path "${customVault}". ` +
            `The sed substitution failed to rewrite the default literal. ` +
            `File body (first 200 chars): ${ruleBody.slice(0, 200)}`,
        );

        assert.equal(
          ruleBody.includes("C:\\Obsidian_Vaults"),
          false,
          "Installed obsidian-workflow.md still contains the literal `C:\\Obsidian_Vaults`. " +
            "The installer's sed substitution left the default in place.",
        );

        // --- 3. End-to-end proxy for the manual smoke: prove that every
        // affected SKILL.md still references `<Obsidian_Vaults>` and not
        // the literal, so that an agent reading the installed rule file
        // (with the custom path) together with any SKILL.md will resolve
        // the placeholder to the custom path — not to `C:\Obsidian_Vaults`.
        //
        // This is NOT an agent-behavior test — the agent's mental
        // substitution still has to happen at runtime, covered by the
        // manual procedure in tests/smoke-placeholder-resolution.md.
        // What we CAN prove automatically is that the placeholder is
        // the only thing the agent would see in the SKILL.md files,
        // closing off the "agent reads SKILL.md and follows the literal"
        // failure mode. ---
        const affectedSkills = [
          "cadence-init",
          "cadence-sync",
          "cadence-pickup",
          "cadence-learn",
          "cadence-done",
        ];
        const inconsistent = [];
        for (const name of affectedSkills) {
          const skillBody = readFileSync(
            join(CLAUDE_SKILLS_DIR, name, "SKILL.md"),
            "utf8",
          );
          if (skillBody.includes("C:\\Obsidian_Vaults")) {
            inconsistent.push(`${name} still contains literal`);
          }
          if (!skillBody.includes("<Obsidian_Vaults>")) {
            inconsistent.push(`${name} missing placeholder`);
          }
        }
        assert.deepEqual(
          inconsistent,
          [],
          `SKILL.md ↔ rule-file consistency broken: ${inconsistent.join("; ")}. ` +
            `After install, an agent resolving <Obsidian_Vaults> against the ` +
            `rule file at ${installedRule} would get "${customVault}", but the ` +
            `listed SKILL.md files would instruct the agent to use the wrong ` +
            `path — the refactor is not end-to-end consistent.`,
        );
      } finally {
        try {
          rmSync(sandbox, { recursive: true, force: true });
        } catch {
          // best-effort cleanup — sandbox is under os.tmpdir() so the OS
          // will reclaim it eventually even if this fails.
        }
      }
    },
  );
});
