---
name: agile-review
description: Auto-review story changes — detect project type, run code review with fix/re-review cycle (max 3 iterations). Use when reviewing code, checking quality, or the user asks for a review.
---

# Automated Code Review

Run automated code review on the current story's changes.

## Arguments
- `--max-cycles N` (default: 3) — Maximum review/fix iterations
- `--skip-fix` — Report findings only, don't attempt fixes

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

## Step 3: Review Agents

### Always run:
- **code-reviewer**: General code quality, patterns, maintainability
- **security-reviewer**: Security vulnerabilities, secrets, OWASP top 10

### Language-specific:
- Go files → `go-reviewer`
- Python files → `python-reviewer`

### Domain-specific (from specialist configs):
- Check story's specialist context for review agents
- Check loaded prompts and skills for domain routing

## Step 4: Review/Fix Cycle

```
WHILE cycle <= max_cycles:
    run_review()
    IF verdict == PASS → go to Step 5
    IF verdict == FAIL → fix findings, increment cycle
    IF cycle > max_cycles → report remaining, ask user
```

### Review Phase
Run all selected reviewers in parallel. For each:
- Provide changed files, acceptance criteria
- Ask for structured findings with severity levels

### Collect Findings
Merge results. Assign IDs: `F-001`, `F-002`, etc.

### Determine Verdict
- **PASS**: No CRITICAL/HIGH findings with OPEN status
- **FAIL**: Blocking findings exist

### Handle FAIL
1. For each blocking finding, apply **Structured Repair**:
   - **R1 LOCALIZE** — identify exact file, function, line, root cause
   - **R2 PATCH** — generate fix (up to 3 candidates for complex findings)
   - **R3 VALIDATE** — run tests to confirm fix
2. Commit: `fix(<scope>): address review findings (cycle N)\n\nStory: STORY-<name>`
3. Push, increment cycle, loop

### Handle PASS
Report: "All reviews passed. No blocking issues."

## Step 5: Hard Gates

1. **Tests must pass** — run test suite, BLOCK if failing
2. **No CRITICAL security findings** — BLOCK if any remain
3. **Coverage check** — WARN if < 80%
4. **Domain-specific tests** — WARN if missing

## Step 6: Complete

1. Move item from "In Review" to "Done" on `Sprint/Board.md`
2. Update story's **Status** to `Done` with `✅ YYYY-MM-DD`
3. Print review summary with findings counts
