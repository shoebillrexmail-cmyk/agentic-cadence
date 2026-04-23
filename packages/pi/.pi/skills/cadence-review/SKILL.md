---
name: agile-review
description: Auto-review story changes — detect project type, run code review with fix/re-review cycle (max 3 iterations). Use when reviewing code, checking quality, or the user asks for a review.
---

# Automated Code Review

Run automated code review on the current story's changes.

## Arguments
- `--max-cycles N` (default: 3, overridable via Cadence Config `review.max_cycles`) — Maximum review/fix iterations
- `--skip-fix` — Report findings only, don't attempt fixes
- `--consensus` — Force Stage 4 (advocate / judge / consensus-reviewer) even when auto-triggers don't fire

## Step 0: Load Cadence Config

Before anything else, load per-project overrides:

1. Find `AGENTS.md` at repo root
2. Shell: `node shared/scripts/parse-cadence-config.mjs <path-to-AGENTS.md>`
3. Parse JSON: `{ config, warnings, effective }`
4. Log warnings + applied config
5. Apply:
   - `effective["review.max_cycles"]` — cap (`--max-cycles` flag wins if passed)
   - `effective["review.force_consensus"]` — if true, Stage 4 runs every cycle (equivalent to `--consensus`)
   - `effective["agents.disable"]` — skip listed roles (applies to semantic-evaluator, ontologist, contrarian, qa-judge, advocate, judge, consensus-reviewer, pattern-auditor, integration-validator, design-auditor, hacker). Safety gates — Stage 1 mechanical + security reviewer — cannot be disabled; warn and ignore.
   - `effective["review.design_doc_path"]` — explicit design-doc path for `design-auditor` (defaults to first match of `design.md` / `DESIGN.md` / `docs/design.md` / `docs/DESIGN.md`). `NONE` disables the agent.

Missing parser / config file → proceed with defaults.

## Step 1: Context Discovery

1. Find vault path from AGENTS.md under `## Obsidian Project`
2. Determine current story from branch name (`feature/STORY-<name>`)
3. Read the story file for acceptance criteria and specialist context

Initialize: `cycle = 1`, `findings_ledger = []`

## Step 2: Detect What Changed

Run `git diff develop...HEAD --name-only`. Classify changes:
- **go**: `.go` files
- **python**: `.py` files
- **frontend**: `.tsx`, `.jsx` files
- **backend**: `.ts`, `.js` files in server/API directories

## Step 3: Reviewer Roster

Build the reviewer roster from three sources (additive):

### Always run:
- `code-reviewer` — general code quality
- `security-reviewer` — security

### Language-specific:
- Go files → `go-reviewer`
- Python files → `python-reviewer`

### Domain-specific:
- Story's specialist context + loaded prompts + skill `specialists.md` files

## Step 4: 4-Stage Evaluation — Skill orchestrates, `evaluator` aggregates

Pi runs each role sequentially (no subagents) and feeds all stage outputs into the `evaluator` role for final aggregation. Role prompts live in `.pi/prompts/shared-agents.md`.

### Stage 1 — Mechanical

Run directly: build, lint, tests, coverage. Capture `{status: PASS|FAIL, findings: [...]}`. If FAIL, skip stages 2-4 and aggregate.

### Stage 2 — Semantic

Apply two roles in sequence (no subagents in Pi):

1. `semantic-evaluator` with full story (GOAL, CONSTRAINTS, EXIT_CONDITIONS), diff summary, AC list, interview notes. Capture its returned block.

2. `ontologist` in `gate-only` mode with a **post-implementation target** = full story content + appended `## Current Implementation` section containing: `git diff develop...HEAD --stat`, changed/new method or API signatures, new dependencies, any new storage shape. This re-checks whether the as-built code still solves the root problem — catches drift that `semantic-evaluator` may miss when structured spec fields still align. Skip if `agents.disable` includes `ontologist`.

Capture `stage2_output = {semantic_evaluator, ontologist_post_impl}`.

Skip stages 3-4 and aggregate if **either**:
- `semantic-evaluator` verdict is `DRIFTED`
- `ontologist` verdict is `REWRITE`, `SPLIT`, or `BLOCK`

### Stage 3 — Domain review
Apply each role in sequence (Pi has no parallel subagents):
- `qa-judge` with AC list + test files + coverage + diff
- `code-reviewer`, `security-reviewer` with changed files
- Language reviewers + domain reviewers from the roster

Optional augmentations:
- `pattern-auditor` (if domain bug catalog exists)
- `integration-validator` (if layer boundaries declared)
- `contrarian` (if the story has a populated `## Assumption Stress Test` section OR any Stage 4 trigger is active) with: target = story + implementation summary; stated assumptions = the story's `## Assumption Stress Test` list plus any assumptions the post-impl ontologist surfaced in Stage 2; domain context from specialist context. A `FLAG_RISK` becomes a HIGH finding; `REWRITE_APPROACH` becomes CRITICAL. Skip if `agents.disable` includes `contrarian`.
- `design-auditor` (if a design doc exists at `review.design_doc_path` or the default `design.md` / `DESIGN.md` / `docs/design.md` / `docs/DESIGN.md`) with: the design document path, the changed-files list + diff, and story GOAL/CONSTRAINTS/NON_GOALS. The agent returns a discrepancy table with per-row resolution `UPDATE_CODE | UPDATE_DESIGN | ASK_USER`. The skill does NOT auto-fix code for `UPDATE_DESIGN` or `ASK_USER` rows — see Step 5 for the handler. Skip if the agent returns `NO_DESIGN_DOC` or `agents.disable` includes `design-auditor`.

Capture all outputs.

### Stage 4 — Consensus (conditional)

Run when ANY concrete trigger fires:
- `--consensus` flag passed
- Regression count ≥ 2 in prior ledger
- ≥2 Stage-3 roles produced overlapping findings (same file + overlapping line range) with DIFFERENT severity levels
- Story marked high-stakes (`## Specialist Context` tag `high-risk: true`, OR CONSTRAINTS contains "mainnet", "production", "payments", "auth", "keypair", "signing", "funds")
- Any CRITICAL severity finding from Stage 3

If triggered:
- Apply `advocate` role on MEDIUM+ findings
- Apply `judge` role on advocate output + original findings
- Apply `consensus-reviewer` role on raw findings + judge rulings + prior ledger

Otherwise skip — mark Stage 4 NOT_RUN.

### Aggregate
Apply `evaluator` role with all stage outputs (`stage2_output = {semantic_evaluator, ontologist_post_impl}`; `stage3_outputs` may include `contrarian`) + prior ledger. It returns the consolidated ledger, overall verdict, blocking findings, next action, and stages-to-re-run-next-cycle.

Severity mapping for the new Stage 2/3 inputs:
- `ontologist_post_impl` verdict `REWRITE` / `SPLIT` / `BLOCK` → one CRITICAL finding each (design-level drift or missing prerequisite — blocks PASS)
- `contrarian` recommendation `REWRITE_APPROACH` → one CRITICAL finding
- `contrarian` recommendation `FLAG_RISK_<#s>` → one HIGH finding per flagged inversion
- `design-auditor` discrepancies become findings with the agent-reported severity plus a `resolution_hint` (`UPDATE_CODE` / `UPDATE_DESIGN` / `ASK_USER`). `NO_DESIGN_DOC` is an advisory note, not a finding.

## Step 5: Review/Fix Cycle

```
WHILE cycle <= max_cycles:
    run_evaluation()
    IF verdict == PASS → go to Step 6
    IF verdict in [FIX_REQUIRED, BLOCK] → fix findings, increment cycle
    IF cycle > max_cycles → report remaining, ask user
```

### Verdict mapping

| Evaluator verdict | Cycle action |
|-------------------|-------------|
| `PASS` | Proceed to Hard Gates |
| `FIX_REQUIRED` | Run Structured Repair on OPEN HIGH+ findings, commit, re-cycle |
| `BLOCK` | Run Structured Repair on CRITICAL findings with priority; leave In Review if unfixable |

### Handle FIX_REQUIRED / BLOCK

1. **Pre-repair: partition `design-auditor` findings by resolution_hint**:
   - `UPDATE_CODE` → falls through to Structured Repair with the other findings
   - `UPDATE_DESIGN` → offer to edit `design.md` directly; on user accept → mark RESOLVED; on decline → mark ACCEPTED_DIVERGENCE. Do NOT touch code.
   - `ASK_USER` → surface the agent's confirmation prompt verbatim, wait for `code` / `design` / `skip`, route accordingly. Never pick a side for the user.

2. For each remaining blocking finding, apply **Structured Repair**:
   - **R1 LOCALIZE** — exact file, function, line, root cause
   - **R2 PATCH** — fix (up to 3 candidates for complex findings)
   - **R3 VALIDATE** — run tests to confirm

3. Commit: code edits → `fix(<scope>): address review findings (cycle N)\n\nStory: STORY-<name>`; design.md edits alone → `docs(<scope>): reconcile design.md with implementation`
4. Push, increment cycle, loop

### Stuck-recovery
If the same finding appears as REGRESSION across 2 cycles, or repair fails on it across 2 cycles, apply the `hacker` role with: the finding, attempts log, story GOAL and CONSTRAINTS. Hacker produces ranked alternatives. Surface to user; never auto-apply.

### Handle PASS
Report: "Evaluator PASS. No blocking issues."

## Step 6: Hard Gates

1. **Tests must pass** — run test suite, BLOCK if failing
2. **No CRITICAL security findings** — BLOCK if any remain
3. **Coverage check** — WARN if < 80%
4. **Domain-specific tests** — WARN if missing

## Step 7: Complete

1. Move item from "In Review" to "Done" on `Sprint/Board.md`
2. Update story's **Status** to `Done` with `✅ YYYY-MM-DD`
3. Print review summary with findings counts
