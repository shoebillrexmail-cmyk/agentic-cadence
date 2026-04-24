#!/usr/bin/env node
/**
 * Integration test for STORY-claude-skill-vault-placeholder.
 *
 * Verifies that running `packages/claude/install.sh` with a non-default
 * `OBSIDIAN_VAULT_PATH` rewrites `obsidian-workflow.md` with the chosen
 * path — the installer's sed substitution is the authoritative runtime
 * vault-root resolver that `<Obsidian_Vaults>` placeholders in SKILL.md
 * files resolve against.
 *
 * Skipped automatically if `bash` is not on PATH (e.g. a CI image with
 * only PowerShell). Not skipped on Windows when running under Git Bash /
 * MSYS — the existing install.sh already detects msys/cygwin OSTYPE.
 *
 * Run: node --test shared/scripts/install-substitution.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const INSTALL_SH = resolve(REPO_ROOT, "packages/claude/install.sh");

function hasBash() {
  const res = spawnSync("bash", ["--version"], { encoding: "utf8" });
  return res.status === 0;
}

describe("install.sh sed-substitution against obsidian-workflow.md", () => {
  test(
    "installing with OBSIDIAN_VAULT_PATH rewrites obsidian-workflow.md to the custom path",
    { skip: !hasBash() && "bash not available on PATH" },
    () => {
      const sandbox = mkdtempSync(join(tmpdir(), "cadence-install-"));
      const fakeHome = join(sandbox, "home");
      const customVault = join(sandbox, "CustomVault");

      try {
        // install.sh is interactive: pipe "" (accept default vault prompt since
        // OBSIDIAN_VAULT_PATH is set) then "Y" (accept create-vault prompt).
        const res = spawnSync(
          "bash",
          [INSTALL_SH],
          {
            input: "\nY\n",
            env: {
              ...process.env,
              HOME: fakeHome,
              OBSIDIAN_VAULT_PATH: customVault,
              OSTYPE: process.env.OSTYPE ?? "linux-gnu",
            },
            encoding: "utf8",
            timeout: 30_000,
          },
        );

        assert.equal(
          res.status,
          0,
          `install.sh exited ${res.status}.\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
        );

        const installedRule = join(
          fakeHome,
          ".claude",
          "rules",
          "common",
          "obsidian-workflow.md",
        );
        assert.ok(
          existsSync(installedRule),
          `Expected installed rule at ${installedRule}. stdout:\n${res.stdout}`,
        );

        const body = readFileSync(installedRule, "utf8");

        assert.ok(
          body.includes(customVault),
          `Installed obsidian-workflow.md does NOT contain the custom vault path "${customVault}". ` +
            `The sed substitution failed to rewrite the default literal.`,
        );

        assert.equal(
          body.includes("C:\\Obsidian_Vaults"),
          false,
          "Installed obsidian-workflow.md still contains the literal `C:\\Obsidian_Vaults`. " +
            "The installer's sed substitution left the default in place.",
        );
      } finally {
        try {
          rmSync(sandbox, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    },
  );
});
