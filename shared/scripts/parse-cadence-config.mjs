#!/usr/bin/env node
/**
 * Cadence Config parser.
 *
 * Reads an optional `## Cadence Config` block from CLAUDE.md / AGENTS.md
 * and returns { config, warnings, effective }. Exits 0 always; malformed
 * input becomes warnings rather than blocking the calling skill.
 *
 * CLI:
 *   node shared/scripts/parse-cadence-config.mjs <path-to-context-file>
 *   → emits a single JSON line: {"config":{...},"warnings":[...],"effective":{...}}
 *
 * Module:
 *   import { parseConfig, DEFAULTS } from "./parse-cadence-config.mjs";
 */

import { readFileSync, existsSync } from "node:fs";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// ── Supported keys, their types, and defaults ──────────────────────────
//
// Each entry: [defaultValue, type, extraValidation?]
// type: "int" | "bool" | "string[]"
// extraValidation: function(value) → null | errorMessage

const SCHEMA = {
  "interview.max_rounds": [5, "int", (v) => (v > 0 ? null : "must be positive")],
  "interview.auto_trigger_on_vague": [true, "bool"],
  "review.force_consensus": [false, "bool"],
  "review.max_cycles": [3, "int", (v) => (v > 0 ? null : "must be positive")],
  "story.skip_interview_for_clear_requests": [true, "bool"],
  "story.require_structured_spec": [true, "bool"],
  "agents.disable": [[], "string[]"],
  "pickup.stuck_threshold": [3, "int", (v) => (v > 0 ? null : "must be positive")],
};

/**
 * Exported DEFAULTS — the fallback values skills use when config is absent
 * or a key is malformed. Deep-cloned at export time so consumers can't
 * accidentally mutate the canonical defaults.
 */
export const DEFAULTS = Object.freeze(
  Object.fromEntries(
    Object.entries(SCHEMA).map(([key, [defaultValue]]) => [
      key,
      Array.isArray(defaultValue) ? [...defaultValue] : defaultValue,
    ])
  )
);

// ── Value coercion helpers ─────────────────────────────────────────────

function coerceInt(raw) {
  // Accept plain digits (optionally signed). Reject anything else.
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return { error: "expected int" };
  const value = parseInt(trimmed, 10);
  if (Number.isNaN(value)) return { error: "expected int" };
  // Reject values outside the safe-integer range — typo or malicious input.
  if (!Number.isSafeInteger(value)) {
    return { error: "expected int (value exceeds safe integer range)" };
  }
  return { value };
}

function coerceBool(raw) {
  const lower = raw.trim().toLowerCase();
  if (["true", "yes", "1"].includes(lower)) return { value: true };
  if (["false", "no", "0"].includes(lower)) return { value: false };
  return { error: "expected bool (true/false/yes/no/1/0)" };
}

function coerceStringArray(raw) {
  const trimmed = raw.trim();
  // Require [ ... ] format
  if (!/^\[.*\]$/s.test(trimmed)) {
    return { error: "expected array like [a, b, c]" };
  }
  const inner = trimmed.slice(1, -1).trim();
  if (inner === "") return { value: [] };
  const items = inner.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  return { value: items };
}

function coerce(raw, type) {
  switch (type) {
    case "int":
      return coerceInt(raw);
    case "bool":
      return coerceBool(raw);
    case "string[]":
      return coerceStringArray(raw);
    default:
      return { error: `unknown type ${type}` };
  }
}

// ── Block extraction ───────────────────────────────────────────────────

/**
 * Pull the lines between `## Cadence Config` and the next `## ` heading
 * (or end of file). Returns [] if no block exists.
 */
function extractBlockLines(source) {
  // Normalize line endings before splitting
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const headingIndex = lines.findIndex(
    (l) => /^##\s+Cadence Config\s*$/i.test(l)
  );
  if (headingIndex === -1) return [];

  const out = [];
  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break; // next heading → stop
    out.push(line);
  }
  return out;
}

// ── Main parser ────────────────────────────────────────────────────────

/**
 * Parse a source string (CLAUDE.md / AGENTS.md contents) for the
 * `## Cadence Config` block.
 *
 * @param {string} source
 * @returns {{ config: Object, warnings: string[], effective: Object }}
 *   - config: user-supplied keys only
 *   - warnings: human-readable messages for unknown keys / bad values / malformed lines
 *   - effective: DEFAULTS merged with config (what skills actually use)
 */
export function parseConfig(source) {
  // F-003: tolerate non-string inputs (numbers, objects, null, undefined) —
  // module callers might pass anything; fail-soft contract says never throw.
  const src = typeof source === "string" ? source : "";

  // F-002: Object.create(null) defends against later `key in config` checks
  // picking up prototype pollution; and lets us append user keys safely.
  const config = Object.create(null);
  const warnings = [];

  const lines = extractBlockLines(src);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip blanks and comments
    if (line === "" || line.startsWith("#")) continue;

    // Malformed: no colon
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      warnings.push(`malformed line (no ':'): ${JSON.stringify(line)}`);
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();

    // Unknown key — F-001: use Object.hasOwn to avoid prototype-chain keys
    // like `__proto__`, `constructor`, `toString` passing the check and
    // then crashing on the downstream destructure of SCHEMA[key].
    if (!Object.hasOwn(SCHEMA, key)) {
      warnings.push(`unknown key: ${key} (ignored)`);
      continue;
    }

    const [, type, extraValidation] = SCHEMA[key];
    const { value, error } = coerce(raw, type);

    if (error) {
      warnings.push(`bad value for ${key}: ${error}; using default`);
      continue;
    }

    // Type passed — run extra validation
    if (extraValidation) {
      const validationError = extraValidation(value);
      if (validationError) {
        warnings.push(`bad value for ${key}: ${validationError}; using default`);
        continue;
      }
    }

    config[key] = value;
  }

  // Build effective = DEFAULTS overlaid with config.
  // F-002: structuredClone so each call gets a fresh copy of array/object
  // defaults; callers can mutate `effective` safely without polluting the
  // shared DEFAULTS export or the next parseConfig() call's output.
  const effective = structuredClone(DEFAULTS);
  for (const key of Object.keys(config)) {
    effective[key] = config[key];
  }

  // Normalize config to a plain object for JSON-serialization friendliness
  // (Object.create(null) objects don't JSON.stringify cleanly in all runtimes).
  const configPlain = { ...config };

  return { config: configPlain, warnings, effective };
}

// ── CLI entry ──────────────────────────────────────────────────────────

function main() {
  const path = argv[2];

  if (!path) {
    // No path → output defaults
    console.log(JSON.stringify({ config: {}, warnings: [], effective: DEFAULTS }));
    return;
  }

  if (!existsSync(path)) {
    // Missing file is not a skill-blocker — treat as "no config"
    console.log(
      JSON.stringify({
        config: {},
        warnings: [`context file not found: ${path}`],
        effective: DEFAULTS,
      })
    );
    return;
  }

  let source = "";
  try {
    source = readFileSync(path, "utf8");
  } catch (err) {
    console.log(
      JSON.stringify({
        config: {},
        warnings: [`could not read ${path}: ${err.message}`],
        effective: DEFAULTS,
      })
    );
    return;
  }

  const result = parseConfig(source);
  console.log(JSON.stringify(result));
}

// Only run CLI if invoked directly (not when imported by tests).
// Compare fully-resolved absolute paths to avoid relative-path / url-prefix mismatches.
const isDirectInvocation = (() => {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] || "");
  } catch {
    return false;
  }
})();

if (isDirectInvocation) {
  main();
}
