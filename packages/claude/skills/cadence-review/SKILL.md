---
description: Auto-review a story in "In Review" — detect project type, run relevant review agents in a fix/re-review cycle (max 3 iterations), move to Done
---

Run automated code review on the current story's changes. Detects what changed and which review agents are relevant, runs them in parallel, fixes blocking issues, and re-reviews — up to `max_cycles` iterations.

## Arguments

- `--max-cycles N` (default: 3, overridable via Cadence Config `review.max_cycles`) — Maximum review/fix iterations before stopping and reporting remaining issues to user
- `--skip-fix` — Run review only, report findings, do not attempt fixes (useful for dry-run review)
- `--consensus` — Force Stage 4 (advocate / judge / consensus-reviewer) even when auto-triggers don't fire. Use for high-stakes stories.

## Step 0: Load Cadence Config

Before anything else, load per-project overrides:

1. Find `CLAUDE.md` at the repo root
2. Run via Bash: `node shared/scripts/parse-cadence-config.mjs <path-to-CLAUDE.md>`
3. Parse JSON: `{ config, warnings, effective }`
4. Log warnings + applied config to the user
5. Apply to downstream:
   - `effective["review.max_cycles"]` — cap on review/fix iterations (`--max-cycles` flag wins if passed)
   - `effective["review.force_consensus"]` — if true, treat it the same as `--consensus` (Stage 4 runs every cycle)
   - `effective["agents.disable"]` — skip Task invocations for listed agents (applies to any agent in the pipeline: semantic-evaluator, ontologist, contrarian, qa-judge, advocate, judge, consensus-reviewer, pattern-auditor, integration-validator, design-auditor, hacker). Required agents like Stage 1 mechanical checks are NOT configurable.
   - `effective["review.design_doc_path"]` — explicit path to the design document (defaults: `design.md`, `DESIGN.md`, `docs/design.md`, `docs/DESIGN.md`, first match wins). If set to `NONE`, the `design-auditor` agent is skipped.

Safety note: security reviewer and mechanical Stage 1 checks cannot be disabled via config. If `agents.disable` contains them, warn and ignore.

Missing parser / config file → proceed with defaults.

## Step 1: Context Discovery

1. Find the vault path from `CLAUDE.md` under `## Obsidian Project`
2. Determine the current story from the branch name (`feature/STORY-<name>` or `hotfix/STORY-<name>`)
3. Read the story file to get acceptance criteria, specialist context, and PR link
4. Verify the story is in "In Review" on `Sprint/Board.md` — if not, warn the user but continue (useful for pre-review checks)

Initialize cycle state:
```
cycle = 1
max_cycles = N (from args, default 3)
findings_ledger = []   # tracks all findings across cycles
```

## Step 2: Detect What Changed

Run `git diff develop...HEAD --name-only` to get the list of changed files.

Classify changes into general categories:
- **go**: `.go` files
- **python**: `.py` files
- **frontend**: `.tsx`, `.jsx` files
- **backend**: `.ts`, `.js` files in server/API directories
- **general**: All other code files

## Step 3: Discover Review Agents

Build the review agent list from two sources:

### Built-in agents (always run for any code changes):

| Agent | Purpose |
|-------|---------|
| `code-reviewer` | General code quality, patterns, maintainability |
| `security-reviewer` | Security vulnerabilities, secrets, OWASP top 10 |

### Language-specific agents (if those file types changed):

| Condition | Agent | Purpose |
|-----------|-------|---------|
| Go files changed | `go-reviewer` | Idiomatic Go, concurrency, error handling |
| Python files changed | `python-reviewer` | PEP 8, type hints, Pythonic patterns |

### Domain-specific agents (MANDATORY — check ALL discovery sources):

Domain agents are discovered from multiple sources. Check ALL of them — not just one:

1. **Story's Specialist Context** — read `## Specialist Context` to find the domain. If it lists review agents, add them.
2. **Loaded rules in `~/.claude/rules/`** — scan for files that contain domain-specific routing logic (agent trigger tables, detection criteria). If the current project matches a routing file's detection criteria, its review agents are MANDATORY — add them to the dispatch list.
3. **Installed plugin `specialists.md` files** — if a domain plugin provides a `specialists.md`, read its **Review** section for the agent table.

For each entry in any Review agents table (from any source), check if the condition is met (based on changed files), and add the agent to the dispatch list.

**Important**: Sources 1-3 are additive, not alternatives. A project may match domain routing rules even if the story has no specialist context (legacy stories, or story created without `/cadence:story`). Always check loaded rules independently of the story.

### Domain MCP enrichment (from specialist config):

If the domain's specialist config lists MCP tools for review, run them after local agents complete for cross-referencing.

## Step 4: 4-Stage Evaluation — Skill orchestrates, `evaluator` aggregates

The skill owns the Task tool and orchestrates the four stages. The `evaluator` agent is an **aggregator** called at the end of each cycle to consolidate stage outputs into the final ledger + verdict. This keeps Task-invocation in the skill (subagents cannot reliably Task-invoke each other).

### Stage 1 — Mechanical

Run directly in the skill (no agent call):
- `npm run build` (or language-equivalent) — capture pass/fail + output
- Lint (`eslint`, `ruff`, `golangci-lint`, ...) — capture
- Test suite — capture pass/fail + counts
- Coverage — capture percentage vs. 80% target

Collect into `stage1_output = {status: PASS|FAIL, findings: [...]}`. If FAIL, stages 2-4 are NOT_RUN this cycle — skip straight to aggregation.

### Stage 2 — Semantic (parallel)

Two checks run in parallel — one measures code-level drift against the structured spec, the other re-checks whether the implementation still solves the root problem.

Launch in parallel via Task tool:

1. **Task → `semantic-evaluator`** with:
   - The full story (structured spec fields — GOAL, CONSTRAINTS, NON_GOALS, EVALUATION_PRINCIPLES, EXIT_CONDITIONS from `seed-architect`)
   - Implementation summary (diff summary + commit messages)
   - Acceptance criteria list
   - Interview notes (if available)

2. **Task → `ontologist`** in `gate-only` mode with a **post-implementation target**: the full story file content PLUS an appended `## Current Implementation` section containing:
   - `git diff develop...HEAD --stat` summary
   - New or materially changed method/API signatures
   - New dependencies or external calls introduced
   - Any new storage / state shape

   This post-impl gate asks the 4 questions (Essence, Root Cause, Prerequisites, Hidden Assumptions) against the *as-built* artifact. It catches the case where the code drifted away from the root problem even when `semantic-evaluator` still says spec-fields match. Skip if `agents.disable` includes `ontologist`.

Collect `stage2_output = {semantic_evaluator: <block>, ontologist_post_impl: <block | NOT_RUN>}`.

If **either** of these is true, stages 3-4 are NOT_RUN this cycle — go straight to aggregation; the skill fixes design-level drift before resuming code-level review:
- `semantic-evaluator` verdict is `DRIFTED`
- `ontologist` verdict is `REWRITE`, `SPLIT`, or `BLOCK`

### Stage 3 — Domain review (parallel)

Launch in parallel via Task tool:
- **Task → `qa-judge`** with story AC list, test files, coverage report, diff
- **Task → `code-reviewer`** (built-in) with changed files
- **Task → `security-reviewer`** (built-in) with changed files
- Language-specific: **Task → `go-reviewer`** / **`python-reviewer`** if relevant files changed
- Domain-specific: each agent from the roster built in Step 3

Optional augmentations:
- **Task → `pattern-auditor`** (if project configured) with domain's bug-pattern catalog + changed files
- **Task → `integration-validator`** (if project configured) with domain's declared layer boundaries
- **Task → `contrarian`** (if the story has a populated `## Assumption Stress Test` section OR Stage 4 triggers are active) with:
  - Target = story + implementation summary
  - Stated assumptions = the list from the story's `## Assumption Stress Test` section (from `cadence-story` Step 5), plus any assumptions surfaced by the post-impl ontologist in Stage 2
  - Domain context from story's `## Specialist Context`

  Contrarian inverts each assumption against the *code* and reports which inversions the implementation accidentally admits. A `FLAG_RISK` or `REWRITE_APPROACH` recommendation is treated as a HIGH-severity finding in the ledger. Skip if `agents.disable` includes `contrarian`.
- **Task → `design-auditor`** (if a design doc exists — resolve path from `review.design_doc_path`, else first match of `design.md` / `DESIGN.md` / `docs/design.md` / `docs/DESIGN.md`; skip entirely if none exist or config is `NONE` or `agents.disable` includes `design-auditor`) with:
  - Design document path
  - Changed files list + diff content
  - Story GOAL / CONSTRAINTS / NON_GOALS

  Design-auditor produces a discrepancy table with a per-row resolution: `UPDATE_CODE`, `UPDATE_DESIGN`, or `ASK_USER`. It does NOT default to fixing the code when the design doc and code disagree.

Collect all outputs into `stage3_outputs = [...]`.

### Stage 4 — Consensus (conditional)

Run when ANY of these concrete triggers fires:

- **`--consensus` flag** passed on invocation — always runs
- **Regression count ≥ 2** — prior ledger has ≥2 findings with status REGRESSION (strong signal something is wrong with the fix loop)
- **Contested findings** — ≥2 Stage-3 agents produced overlapping findings (same file + overlapping line range) but assigned DIFFERENT severity levels — indicates reviewers disagree
- **High-stakes story marker** — story's `## Specialist Context` includes the tag `high-risk: true`, OR the story's `CONSTRAINTS` field contains any of: "mainnet", "production", "payments", "auth", "keypair", "signing", "funds"
- **Critical Stage-3 finding** — any CRITICAL severity finding from Stage 3 (not Stage 1) — adversarial arbitration helps filter false-positive criticals

If no trigger fires, skip Stage 4 entirely and mark it `NOT_RUN` in the aggregator input.

Sequential (each depends on prior):
1. **Task → `advocate`** with MEDIUM+ findings from stages 2-3 + implementation context + story
2. **Task → `judge`** with advocate output + original findings + story
3. **Task → `consensus-reviewer`** with raw stages-2-3 findings + judge rulings + prior ledger

Collect `stage4_output` (consensus-reviewer's consolidated ledger).

### Aggregate — `evaluator`

**Task → `evaluator`** with:
- The full story (for context only — evaluator does not re-evaluate)
- `stage1_output`, `stage2_output` (now `{semantic_evaluator, ontologist_post_impl}`), `stage3_outputs` (includes `contrarian` when run), `stage4_output` (with NOT_RUN for any skipped stage/agent)
- Prior findings ledger from earlier cycles

Evaluator severity mapping for the new inputs:
- `ontologist_post_impl` verdict `REWRITE` / `SPLIT` → one CRITICAL finding (design-level drift; blocks PASS)
- `ontologist_post_impl` verdict `BLOCK` → one CRITICAL finding (missing prerequisite)
- `contrarian` recommendation `REWRITE_APPROACH` → one CRITICAL finding
- `contrarian` recommendation `FLAG_RISK_<#s>` → one HIGH finding per flagged inversion
- `design-auditor` discrepancies become findings with severity as reported by the agent AND a `resolution_hint` field copied verbatim (`UPDATE_CODE` / `UPDATE_DESIGN` / `ASK_USER`). `NO_DESIGN_DOC` is reported as an advisory note, not a finding.

The evaluator returns: `Overall Verdict`, consolidated `Findings Ledger` with stable cross-cycle IDs, `Blocking findings` list, `Next action` directive, and `Stages to re-run on next cycle`.

---

## Step 5: Review/Fix Cycle

```
WHILE cycle <= max_cycles:
    run_stages()           # Skill orchestrates Stages 1-4 as above
    aggregate()            # Task → evaluator
    IF verdict == PASS → break, go to Step 6
    IF verdict in [FIX_REQUIRED, BLOCK] → fix findings, increment cycle
    IF cycle > max_cycles → stop, report to user
```

### 5a: Incremental re-runs on cycle 2+

The previous cycle's evaluator output includes `Stages to re-run on next cycle`. On cycle 2+, only re-run those specific stages (full Stage 1 always runs — cheap). Feed the updated stage outputs back into evaluator with the prior ledger to get cross-cycle RESOLVED/REGRESSION status.

### 5b: Verdict Mapping

The evaluator's verdict maps to the review-cycle state:

| Evaluator verdict | Cycle action |
|-------------------|-------------|
| `PASS` | Go to Step 6 (Hard Gates) |
| `FIX_REQUIRED` | Run Structured Repair on OPEN HIGH+ findings, commit, re-cycle |
| `BLOCK` | Run Structured Repair on CRITICAL findings with priority; if any finding cannot be fixed, leave In Review and report |

### 5c: Handle FIX_REQUIRED / BLOCK Verdict

If `--skip-fix` was passed: report all findings and stop (no fix attempt).

If `cycle < max_cycles`:
1. Display findings summary: "{N} blocking issues found (cycle {cycle}/{max_cycles})"

2. **Pre-repair: handle `design-auditor` findings separately**. Before Structured Repair, partition design-auditor findings by `resolution_hint`:
   - `UPDATE_CODE` → fall through to Structured Repair alongside other findings (skill fixes the code)
   - `UPDATE_DESIGN` → skill offers to edit `design.md` directly (ONE-line edit; the user can veto). Do NOT fix the code for these. After edit, mark the finding `RESOLVED` in the ledger. If the user declines, mark `ACCEPTED_DIVERGENCE` and leave it.
   - `ASK_USER` → pause the cycle. For each, surface the agent's "User confirmation prompt" verbatim to the user and wait for a one-word answer: `code` (fix the code) / `design` (update design.md) / `skip` (mark ACCEPTED_DIVERGENCE and continue). Route accordingly. Never pick a side on the user's behalf.

   Only after all design-auditor findings have been partitioned and ASK_USER answers collected do we proceed to the next substep.

3. For each remaining blocking finding, apply **Structured Repair (R1/R2/R3)**:

   **Phase R1 — LOCALIZE** (read-only analysis):
   - Identify the exact file, function, and line range responsible for the finding
   - Classify the root cause: logic error, missing validation, wrong API usage, security flaw, etc.
   - Produce a localization summary: `{file}:{line_range} — {suspected_cause}`

   **Phase R2 — PATCH** (generate fix):
   - Using only the localized context (not the full codebase), generate the fix
   - For complex findings, generate up to 3 candidate approaches
   - Each fix should be minimal — change only what's needed to resolve the finding
   - Follow domain rules from the story's specialist context

   **Phase R3 — VALIDATE** (verify fix):
   - Apply the fix
   - Run the relevant tests to confirm it works
   - Check that the fix doesn't break existing tests
   - If tests fail: try next candidate (if multiple were generated)
   - If all candidates fail: flag as "needs manual fix" and continue to next finding

4. Stage and commit all successful fixes (code edits AND any `design.md` edits from step 2):
   ```
   fix(<scope>): address review findings (cycle <cycle>)

   Findings fixed: F-001, F-003, F-007
   Story: STORY-<name>
   ```
   If only `design.md` changed, use `docs(<scope>): reconcile design.md with implementation` as the commit type instead.
5. Push to the feature branch: `git push`
6. Update ledger: mark fixed findings as `RESOLVED` with current cycle number. Mark unfixable findings as `OPEN (manual fix needed)`. Mark `ASK_USER` skipped items as `ACCEPTED_DIVERGENCE`.
7. Increment cycle: `cycle = cycle + 1`
8. Loop back to **5a** (incremental review)

If `cycle >= max_cycles` (max iterations reached):
1. Display all remaining OPEN findings with full details
2. Report: "Review cycle limit reached ({max_cycles} cycles). {N} issues remain unresolved."
3. List each unresolved finding with file, line, severity, and description
4. Leave story in "In Review" — do NOT move to Done
5. Ask user:
   - "Fix remaining issues manually and re-run `/cadence:review`"
   - "Accept as-is and move to Done anyway"
   - "Leave in review for now"

### 5d: Handle PASS Verdict

1. Report: "Evaluator PASS (cycle {cycle}/{max_cycles}). No blocking issues."
2. If MEDIUM/LOW findings exist, list them as advisory
3. Proceed to Step 6

### 5e: Stuck-Recovery

If cycles 2 and 3 both produce the same finding in REGRESSION state, or if repair fails for the same finding across 2 cycles, delegate to the `hacker` shared agent:

**Task → `hacker`** with: the stuck finding, the prior attempts log, the story GOAL and CONSTRAINTS. Expect: ranked alternatives (bypass / reframe / relax-constraint options). Surface options to the user and ask which to try — do NOT auto-apply hacker output.

---

## Step 6: Hard Gates (before completing)

Before moving to Done, enforce these non-negotiable quality gates:

### Gate 1: Tests Must Pass
- Run the project's test suite (`npm test`, `go test ./...`, `pytest`, etc.)
- If tests fail: DO NOT move to Done. Report which tests failed and ask user to fix.

### Gate 2: No CRITICAL Security Findings
- If any finding with severity CRITICAL is still OPEN: BLOCK.
- Report: "Cannot complete — {N} CRITICAL security findings remain. These must be resolved."

### Gate 3: Coverage Check (if coverage tooling exists)
- Run coverage check if tools are configured
- If coverage < 80%: WARN (do not block, but report the gap)
- Report: "Coverage is {N}% (target: 80%). Consider adding tests."

### Gate 4: Domain-specific Tests (if domain plugin defines test types)
- If domain-specific test types are defined in the story's testing strategy, verify they exist and pass
- If missing: WARN strongly

If any BLOCKING gate fails: leave in "In Review", report what needs fixing.
If only WARNINGs: report them, proceed to Done (user decides).

---

## Step 7: Complete Review (Move to Done)

1. Move item from "In Review" to "Done" on `Sprint/Board.md`
2. Update the story's **Status** to `Done`
3. Add completion date: `✅ YYYY-MM-DD` (use today's date)
4. Check off any remaining acceptance criteria that are verified
5. Print review summary:
   ```
   Review complete (cycle {final_cycle}/{max_cycles})
   - Total findings: {total}
   - Resolved: {resolved}
   - Advisory (MEDIUM/LOW): {advisory}
   ```
6. Ask: "Story is done. Exit worktree? (keep branch until PR merges)"

---

## Notes

- This skill can be triggered manually via `/cadence:review` at any time
- It is also triggered automatically by `/cadence:done` after creating the PR
- Re-running on an already-reviewed story is safe — it just re-checks the current state
- Regressions (fixed then reappeared) are automatically elevated to CRITICAL severity
- The `--max-cycles` flag can be overridden per invocation for particularly complex stories
- Domain-specific review agents are discovered from the specialist config — not hardcoded
- Each cycle only re-runs agents that had findings — clean agents are not re-dispatched
