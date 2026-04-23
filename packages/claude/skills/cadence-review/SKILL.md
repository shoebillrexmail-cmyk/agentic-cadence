---
description: Auto-review a story in "In Review" — detect project type, run relevant review agents in a fix/re-review cycle (max 3 iterations), move to Done
---

Run automated code review on the current story's changes. Detects what changed and which review agents are relevant, runs them in parallel, fixes blocking issues, and re-reviews — up to `max_cycles` iterations.

## Arguments

- `--max-cycles N` (default: 3) — Maximum review/fix iterations before stopping and reporting remaining issues to user
- `--skip-fix` — Run review only, report findings, do not attempt fixes (useful for dry-run review)

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

## Step 4: Launch Reviews

Launch ALL selected agents **in parallel** using the Agent tool.

---

## Step 5: Review/Fix Cycle

```
WHILE cycle <= max_cycles:
    run_review()
    IF verdict == PASS → break, go to Step 6
    IF verdict == FAIL → fix findings, increment cycle
    IF cycle > max_cycles → stop, report to user
```

### 5a: Run Review (dispatch agents)

**Cycle 1 (full review):**
Launch all selected agents in parallel using the Agent tool. For each agent:
- Provide the list of changed files relevant to that agent
- Provide the story's acceptance criteria for context
- Ask it to produce structured findings with severity levels

**Cycle 2+ (incremental review):**
Only re-run agents that had findings in the previous cycle. Provide them with:
- The diff since last review: `git diff HEAD~1` (the fix commit)
- Previous findings from the ledger (so they can check for regressions)
- Instruction: "Focus on the diff + blast radius. Verify previous findings are resolved. Check for regressions."

### 5b: Collect and Categorize Findings

Merge all agent results. Assign each finding a unique ID (`F-001`, `F-002`, etc., incrementing across cycles).

Update the findings ledger:

| ID | Cycle Found | Cycle Resolved | Status | Severity | Finding | File | Agent |
|----|-------------|----------------|--------|----------|---------|------|-------|
| F-001 | 1 | - | OPEN | CRITICAL | [description] | [file:line] | [responsible agent] |
| F-002 | 1 | 2 | RESOLVED | HIGH | [description] | [file:line] | [responsible agent] |
| F-003 | 2 | - | REGRESSION | HIGH | [description] | [file:line] | [responsible agent] |

Status values:
- `OPEN` — new finding, not yet fixed
- `RESOLVED` — fixed in a later cycle
- `REGRESSION` — was resolved but reappeared (treat as CRITICAL)

### 5c: Determine Verdict

```
blocking = findings where severity in [CRITICAL, HIGH] AND status == OPEN
regressions = findings where status == REGRESSION

IF len(blocking) == 0 AND len(regressions) == 0:
    verdict = PASS
ELSE:
    verdict = FAIL
```

### 5d: Handle FAIL Verdict

If `--skip-fix` was passed: report all findings and stop (no fix attempt).

If `cycle < max_cycles`:
1. Display findings summary: "{N} blocking issues found (cycle {cycle}/{max_cycles})"
2. For each blocking finding, apply **Structured Repair (R1/R2/R3)**:

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

3. Stage and commit all successful fixes:
   ```
   fix(<scope>): address review findings (cycle <cycle>)

   Findings fixed: F-001, F-003, F-007
   Story: STORY-<name>
   ```
4. Push to the feature branch: `git push`
5. Update ledger: mark fixed findings as `RESOLVED` with current cycle number. Mark unfixable findings as `OPEN (manual fix needed)`.
6. Increment cycle: `cycle = cycle + 1`
7. Loop back to **5a** (incremental review)

If `cycle >= max_cycles` (max iterations reached):
1. Display all remaining OPEN findings with full details
2. Report: "Review cycle limit reached ({max_cycles} cycles). {N} issues remain unresolved."
3. List each unresolved finding with file, line, severity, and description
4. Leave story in "In Review" — do NOT move to Done
5. Ask user:
   - "Fix remaining issues manually and re-run `/cadence:review`"
   - "Accept as-is and move to Done anyway"
   - "Leave in review for now"

### 5e: Handle PASS Verdict

1. Report: "All reviews passed (cycle {cycle}/{max_cycles}). No blocking issues."
2. If MEDIUM/LOW findings exist, list them as advisory
3. Proceed to Step 6

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
