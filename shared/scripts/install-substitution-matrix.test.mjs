#!/usr/bin/env node
/**
 * Path-class matrix for STORY-install-sh-sed-hardening.
 *
 * Exercises install.sh's sed substitution across the full range of vault paths
 * a user might reasonably supply — POSIX, POSIX with spaces, POSIX with `&`
 * (sed replacement-string backreference), POSIX with `|` (sed s-command
 * delimiter collision), Windows `C:\...`, Windows with spaces + backslashes,
 * and WSL `/mnt/c/...` — plus three rejection cases (NUL, newline, CR) that
 * must be refused at input-validation time.
 *
 * The existing shared/scripts/install-substitution.test.mjs is deliberately
 * POSIX-scoped and covers the end-to-end SKILL.md ↔ rule-file consistency
 * assertion (from STORY-claude-skill-vault-placeholder). This file holds the
 * path-character-class matrix separately so the scoping comments don't
 * contradict each other.
 *
 * For each happy-path case the test:
 *   1. Runs install.sh in a sandboxed $HOME with OBSIDIAN_VAULT_PATH set.
 *   2. Reads the installed obsidian-workflow.md.
 *   3. Constructs the expected content by substituting the vault path into
 *      the template source at packages/claude/rules/obsidian-workflow.md.
 *   4. Asserts byte-for-byte match.
 *
 * For each rejection case the test:
 *   1. Runs install.sh with a vault path containing a forbidden control byte.
 *   2. Asserts non-zero exit and a clear error on stderr.
 *
 * Skipped automatically when `bash` is unavailable on PATH.
 *
 * Run: node --test shared/scripts/install-substitution-matrix.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const INSTALL_SH = resolve(REPO_ROOT, "packages/claude/install.sh");
const TEMPLATE_PATH = resolve(
  REPO_ROOT,
  "packages/claude/rules/obsidian-workflow.md",
);

function hasBash() {
  const res = spawnSync("bash", ["--version"], { encoding: "utf8" });
  return res?.status === 0;
}

/**
 * Convert a native path to forward-slash form. Only used for sandbox
 * paths that go into HOME — the vault paths under test are passed to
 * the installer verbatim (including their native separator) because
 * verifying verbatim-preservation is the whole point.
 */
function toPosix(p) {
  return p.replace(/\\/g, "/");
}

/**
 * Construct the expected installed rule-file content by substituting the
 * provided vault path into the template at `packages/claude/rules/
 * obsidian-workflow.md`. This is the same mechanical substitution the
 * installer performs — only the literal `C:\Obsidian_Vaults` occurrences
 * are replaced, everything else is semantically identical.
 *
 * Both template and installed rule are normalized to LF line endings
 * before comparison: on Windows git checkouts the template file has
 * CRLF while sed writes LF, so byte-for-byte comparison would trip
 * over line-ending noise rather than substantive content.
 */
function normalizeLineEndings(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function expectedRuleContent(vaultPath) {
  const template = normalizeLineEndings(readFileSync(TEMPLATE_PATH, "utf8"));
  return template.split("C:\\Obsidian_Vaults").join(vaultPath);
}

// ─── Happy-path cases: vault path must appear verbatim in the installed rule file ───
//
// Every case uses a sandbox-nested path so `mkdir -p` succeeds unconditionally.
// The path *suffix* encodes whichever sed-metacharacter class we want to
// exercise. On Git Bash / Linux, backslash is not a path separator, so a
// directory name like `alice\MyVault` is a single literal directory that
// creates cleanly — exercising sed's `\N` backreference hazard without
// requiring Windows-style path permissions.

const HAPPY_CASES = [
  {
    name: "plain POSIX path",
    suffix: "MyVault",
  },
  {
    name: "POSIX path with spaces",
    suffix: "My Documents/Vault",
  },
  {
    name: "POSIX path with ampersand (sed replacement-string backreference)",
    suffix: "docs & backups/Vault",
  },
  {
    name: "POSIX path with pipe (sed s-command delimiter collision)",
    suffix: "strange|path/Vault",
  },
  {
    name: "path with literal backslashes (sed \\N backreference hazard)",
    // On Linux/Git Bash `\` is not a separator; this creates a single dir
    // literally named `Users\alice\MyVault` under the sandbox. Pre-fix,
    // sed's replacement treats `\U`, `\a` etc. as escapes — path mangles.
    suffix: "Users\\alice\\MyVault",
  },
  {
    name: "path with backslashes + spaces (Program Files-style)",
    suffix: "Program Files\\MyVault",
  },
  {
    name: "path with backslash-digit (direct \\1 backreference hit)",
    // `\1` in sed's replacement is the literal backref-1. Before the fix
    // this would insert the whole matched text or an empty string (no
    // capture group defined) rather than a literal `\1`.
    suffix: "group\\1\\2\\3",
  },
];

describe("install.sh path-class matrix — happy paths (sed substitution)", () => {
  for (const c of HAPPY_CASES) {
    test(
      c.name,
      { skip: hasBash() ? false : "bash not available on PATH" },
      () => {
        const sandbox = mkdtempSync(join(tmpdir(), "cadence-matrix-"));
        const fakeHome = toPosix(join(sandbox, "home"));
        mkdirSync(fakeHome, { recursive: true });

        // All cases nest under the sandbox with forced forward-slash
        // separators at the top level; the suffix carries whichever special
        // character class we're testing. On Linux/Git Bash `\` is not a
        // path separator, so a suffix like `Users\alice\MyVault` is one
        // literal directory that `mkdir -p` creates without issue.
        const vaultPath = `${toPosix(sandbox)}/vault/${c.suffix}`;

        // Pre-create the vault dir so the installer doesn't depend on
        // answering "Y" to the create-directory prompt (fewer moving parts
        // in the test). The `mkdirSync` here treats `\` as a literal
        // character on Linux/Git Bash — exactly what we want.
        mkdirSync(vaultPath, { recursive: true });

        const spawnResult = spawnSync("bash", [INSTALL_SH], {
          input: "\n",
          env: {
            ...process.env,
            HOME: fakeHome,
            OBSIDIAN_VAULT_PATH: vaultPath,
          },
          encoding: "utf8",
          timeout: 30_000,
        });

        try {
          assert.equal(
            spawnResult.status,
            0,
            `install.sh exited ${spawnResult.status} for vault path "${vaultPath}".\n` +
              `stdout:\n${spawnResult.stdout}\nstderr:\n${spawnResult.stderr}`,
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
            `Expected ${installedRule} to exist. stdout:\n${spawnResult.stdout}`,
          );

          const actualBody = normalizeLineEndings(
            readFileSync(installedRule, "utf8"),
          );
          const expectedBody = expectedRuleContent(vaultPath);

          assert.equal(
            actualBody,
            expectedBody,
            `Installed obsidian-workflow.md does not match expected content for vault path "${vaultPath}".\n` +
              `First divergence: ${findFirstDifference(actualBody, expectedBody)}`,
          );
        } finally {
          try {
            rmSync(sandbox, { recursive: true, force: true });
          } catch {
            // best-effort
          }
        }
      },
    );
  }
});

// ─── Rejection cases: control characters must be refused at input validation ───

const REJECTION_CASES = [
  {
    name: "path containing NUL is rejected",
    path: "/tmp/cadence/My\x00Vault",
    errorPattern: /NUL|null|control|invalid/i,
  },
  {
    name: "path containing newline is rejected",
    path: "/tmp/cadence/My\nVault",
    errorPattern: /newline|control|invalid/i,
  },
  {
    name: "path containing carriage return is rejected (Windows clipboard paste)",
    path: "/tmp/cadence/MyVault\r",
    errorPattern: /carriage|CR|control|invalid/i,
  },
];

describe("install.sh path-class matrix — control-character rejection", () => {
  for (const c of REJECTION_CASES) {
    test(
      c.name,
      { skip: hasBash() ? false : "bash not available on PATH" },
      () => {
        const sandbox = mkdtempSync(join(tmpdir(), "cadence-matrix-"));
        const fakeHome = toPosix(join(sandbox, "home"));
        mkdirSync(fakeHome, { recursive: true });

        try {
          const spawnResult = spawnSync("bash", [INSTALL_SH], {
            input: "\nY\n",
            env: {
              ...process.env,
              HOME: fakeHome,
              OBSIDIAN_VAULT_PATH: c.path,
            },
            encoding: "utf8",
            timeout: 30_000,
          });

          assert.notEqual(
            spawnResult.status,
            0,
            `install.sh should exit non-zero for vault path containing a forbidden control byte, ` +
              `but exited ${spawnResult.status}.\n` +
              `stdout:\n${spawnResult.stdout}\nstderr:\n${spawnResult.stderr}`,
          );

          const combined = `${spawnResult.stdout}\n${spawnResult.stderr}`;
          assert.match(
            combined,
            c.errorPattern,
            `Error message should mention the control-character class matching ${c.errorPattern}.\n` +
              `Got stdout+stderr:\n${combined}`,
          );

          const installedRule = join(
            sandbox,
            "home",
            ".claude",
            "rules",
            "common",
            "obsidian-workflow.md",
          );
          assert.equal(
            existsSync(installedRule),
            false,
            `install.sh should NOT have written the rule file when rejecting invalid input, ` +
              `but ${installedRule} exists.`,
          );
        } finally {
          try {
            rmSync(sandbox, { recursive: true, force: true });
          } catch {
            // best-effort
          }
        }
      },
    );
  }
});

// ─── Helper: pinpoint byte-level divergence for failed assertion diagnostics ───

function findFirstDifference(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      const ctx = 30;
      const start = Math.max(0, i - ctx);
      const end = Math.min(len, i + ctx);
      return (
        `byte ${i}: actual "${a.slice(start, end)}" vs expected "${b.slice(start, end)}"`
      );
    }
  }
  if (a.length !== b.length) {
    return `length mismatch: actual=${a.length}, expected=${b.length}`;
  }
  return "no difference detected";
}
