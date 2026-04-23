#!/usr/bin/env node
/**
 * Tests for shared/scripts/parse-cadence-config.mjs
 * Run: node shared/scripts/parse-cadence-config.test.mjs
 *
 * Uses Node's built-in node:test (no extra deps).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseConfig, DEFAULTS } from "./parse-cadence-config.mjs";

describe("parseConfig — empty / missing", () => {
  test("empty string returns defaults, no warnings", () => {
    const { config, warnings, effective } = parseConfig("");
    assert.deepEqual(config, {});
    assert.deepEqual(warnings, []);
    assert.deepEqual(effective, DEFAULTS);
  });

  test("CLAUDE.md without ## Cadence Config block returns defaults", () => {
    const src = `# my-project

## Obsidian Project
- Vault project: foo

## Some Other Section
irrelevant
`;
    const { config, warnings, effective } = parseConfig(src);
    assert.deepEqual(config, {});
    assert.deepEqual(warnings, []);
    assert.deepEqual(effective, DEFAULTS);
  });
});

describe("parseConfig — well-formed values", () => {
  test("all supported int keys parse correctly", () => {
    const src = `## Cadence Config
interview.max_rounds: 3
review.max_cycles: 7
pickup.stuck_threshold: 5
`;
    const { config, warnings, effective } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
    assert.equal(config["review.max_cycles"], 7);
    assert.equal(config["pickup.stuck_threshold"], 5);
    assert.deepEqual(warnings, []);
    assert.equal(effective["interview.max_rounds"], 3);
    assert.equal(effective["review.max_cycles"], 7);
  });

  test("boolean variants: true, false, yes, no, 1, 0, case-insensitive", () => {
    const src = `## Cadence Config
review.force_consensus: TRUE
interview.auto_trigger_on_vague: no
story.skip_interview_for_clear_requests: 0
story.require_structured_spec: Yes
`;
    const { config, warnings } = parseConfig(src);
    assert.equal(config["review.force_consensus"], true);
    assert.equal(config["interview.auto_trigger_on_vague"], false);
    assert.equal(config["story.skip_interview_for_clear_requests"], false);
    assert.equal(config["story.require_structured_spec"], true);
    assert.deepEqual(warnings, []);
  });

  test("array parsing with whitespace tolerance", () => {
    const src = `## Cadence Config
agents.disable: [contrarian,  simplifier,   ontology-analyst]
`;
    const { config, warnings } = parseConfig(src);
    assert.deepEqual(config["agents.disable"], [
      "contrarian",
      "simplifier",
      "ontology-analyst",
    ]);
    assert.deepEqual(warnings, []);
  });

  test("empty array", () => {
    const src = `## Cadence Config
agents.disable: []
`;
    const { config } = parseConfig(src);
    assert.deepEqual(config["agents.disable"], []);
  });
});

describe("parseConfig — comments and whitespace", () => {
  test("# comment lines are ignored", () => {
    const src = `## Cadence Config
# this is a comment
interview.max_rounds: 3
# another comment
review.max_cycles: 4
`;
    const { config, warnings } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
    assert.equal(config["review.max_cycles"], 4);
    assert.deepEqual(warnings, []);
  });

  test("blank lines are ignored", () => {
    const src = `## Cadence Config

interview.max_rounds: 3

review.max_cycles: 4

`;
    const { config } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
    assert.equal(config["review.max_cycles"], 4);
  });

  test("trailing whitespace on values is stripped", () => {
    const src = "## Cadence Config\ninterview.max_rounds: 3   \n";
    const { config } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
  });

  test("Windows CRLF line endings are handled", () => {
    const src = "## Cadence Config\r\ninterview.max_rounds: 3\r\n";
    const { config } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
  });

  test("only parses until the next ## heading", () => {
    const src = `## Cadence Config
interview.max_rounds: 3

## Some Other Section
review.max_cycles: 99
`;
    const { config } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
    assert.equal(config["review.max_cycles"], undefined);
  });
});

describe("parseConfig — errors and warnings", () => {
  test("unknown key produces warning", () => {
    const src = `## Cadence Config
completely.made.up: 42
interview.max_rounds: 3
`;
    const { config, warnings } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
    assert.equal(config["completely.made.up"], undefined);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /unknown.*completely\.made\.up/i);
  });

  test("type mismatch (string for int) warns and uses default", () => {
    const src = `## Cadence Config
interview.max_rounds: banana
`;
    const { config, warnings, effective } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], undefined);
    assert.equal(effective["interview.max_rounds"], DEFAULTS["interview.max_rounds"]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /interview\.max_rounds.*expected.*int/i);
  });

  test("type mismatch (non-boolean for bool) warns and uses default", () => {
    const src = `## Cadence Config
review.force_consensus: maybe
`;
    const { config, warnings, effective } = parseConfig(src);
    assert.equal(config["review.force_consensus"], undefined);
    assert.equal(effective["review.force_consensus"], DEFAULTS["review.force_consensus"]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /review\.force_consensus.*expected.*bool/i);
  });

  test("malformed line (no colon) warns and continues", () => {
    const src = `## Cadence Config
this is not a config line
interview.max_rounds: 3
`;
    const { config, warnings } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], 3);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /malformed line/i);
  });

  test("negative int for positive-only field warns", () => {
    const src = `## Cadence Config
interview.max_rounds: -1
`;
    const { config, warnings, effective } = parseConfig(src);
    assert.equal(config["interview.max_rounds"], undefined);
    assert.equal(effective["interview.max_rounds"], DEFAULTS["interview.max_rounds"]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /positive/i);
  });
});

describe("parseConfig — mixed scenarios", () => {
  test("valid + invalid + unknown keys coexist; valid applied", () => {
    const src = `## Cadence Config
interview.max_rounds: 3
unknown.key: value
review.force_consensus: banana
review.max_cycles: 7
`;
    const { config, warnings, effective } = parseConfig(src);
    assert.equal(effective["interview.max_rounds"], 3);
    assert.equal(effective["review.max_cycles"], 7);
    assert.equal(effective["review.force_consensus"], DEFAULTS["review.force_consensus"]);
    assert.equal(warnings.length, 2); // unknown.key + bad bool
  });

  test("effective merges user config over DEFAULTS", () => {
    const src = `## Cadence Config
interview.max_rounds: 2
agents.disable: [contrarian]
`;
    const { effective } = parseConfig(src);
    assert.equal(effective["interview.max_rounds"], 2);
    assert.deepEqual(effective["agents.disable"], ["contrarian"]);
    // Unspecified keys retain defaults
    assert.equal(effective["review.max_cycles"], DEFAULTS["review.max_cycles"]);
    assert.equal(effective["review.force_consensus"], DEFAULTS["review.force_consensus"]);
  });
});

describe("DEFAULTS shape", () => {
  test("DEFAULTS has every key documented in SPEC", () => {
    const required = [
      "interview.max_rounds",
      "interview.auto_trigger_on_vague",
      "review.force_consensus",
      "review.max_cycles",
      "story.skip_interview_for_clear_requests",
      "story.require_structured_spec",
      "agents.disable",
      "pickup.stuck_threshold",
    ];
    for (const key of required) {
      assert.ok(key in DEFAULTS, `DEFAULTS missing key: ${key}`);
    }
  });

  test("DEFAULTS values have expected types", () => {
    assert.equal(typeof DEFAULTS["interview.max_rounds"], "number");
    assert.equal(typeof DEFAULTS["review.force_consensus"], "boolean");
    assert.ok(Array.isArray(DEFAULTS["agents.disable"]));
  });
});
