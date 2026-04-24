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
 * Uses a POSIX-style forward-slash path derived from `os.tmpdir()`. The
 * existing installer has a pre-existing, out-of-scope issue where sed's
 * replacement string mangles Windows-style backslashes — tracked in a
 * separate story. For this refactor, proving the mechanism works on
 * forward-slash paths is sufficient; that covers every Linux/macOS user
 * plus Windows users running under Git Bash with MSYS-translated paths.
 *
 * Skipped automatically if `bash` is not on PATH.
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

/** Convert a native path to forward-slash form. Git Bash / MSYS accepts
 *  these via its POSIX-path emulation, and sed's replacement string does
 *  not treat `/` as special. */
function toPosix(p) {
  return p.replace(/\\/g, "/");
}

describe("install.sh sed-substitution against obsidian-workflow.md", () => {
  test(
    "installing with OBSIDIAN_VAULT_PATH rewrites obsidian-workflow.md to the custom path",
    { skip: !hasBash() && "bash not available on PATH" },
    () => {
      const sandbox = mkdtempSync(join(tmpdir(), "cadence-install-"));
      const fakeHome = toPosix(join(sandbox, "home"));
      const customVault = toPosix(join(sandbox, "CustomVault"));

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
              // Force non-Windows codepath so sed uses the Linux default
              // substitution, avoiding the known Windows-backslash issue
              // (tracked in a separate installer-hardening story).
              OSTYPE: "linux-gnu",
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
          sandbox,
          "home",
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
            `The sed substitution failed to rewrite the default literal. ` +
            `File body (first 200 chars): ${body.slice(0, 200)}`,
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
