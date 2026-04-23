---
name: agile-review
description: Auto-review story changes — detect project type, run code review with fix/re-review cycle (max 3 iterations). Use when reviewing code, checking quality, or the user asks for a review.
---

# Automated Code Review

Run automated code review on the current story's changes.

## Arguments
- `--max-cycles N` (default: 3) — Maximum review/fix iterations
- `--skip-fix` — Report findings only, don't attempt fixes
- `--consensus` — Force Stage 4 (advocate / judge / consensus-reviewer) even when auto-triggers don't fire

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
Apply `semantic-evaluator` role with: full story (GOAL, CONSTRAINTS, EXIT_CONDITIONS), diff summary, AC list, interview notes. Capture its returned block.

If verdict is `DRIFTED`, skip stages 3-4 and aggregate.

### Stage 3 — Domain review
Apply each role in sequence (Pi has no parallel subagents):
- `qa-judge` with AC list + test files + coverage + diff
- `code-reviewer`, `security-reviewer` with changed files
- Language reviewers + domain reviewers from the roster
- Optional: `pattern-auditor` (if domain bug catalog exists), `integration-validator` (if layer boundaries declared)

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
Apply `evaluator` role with all stage outputs + prior ledger. It returns the consolidated ledger, overall verdict, blocking findings, next action, and stages-to-re-run-next-cycle.

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
1. For each blocking finding, apply **Structured Repair**:
   - **R1 LOCALIZE** — exact file, function, line, root cause
   - **R2 PATCH** — fix (up to 3 candidates for complex findings)
   - **R3 VALIDATE** — run tests to confirm
2. Commit: `fix(<scope>): address review findings (cycle N)\n\nStory: STORY-<name>`
3. Push, increment cycle, loop

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
