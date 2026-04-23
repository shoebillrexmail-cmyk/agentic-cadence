---
description: Pick up a story from the sprint board — load specialist context, enforce TDD, start working in a worktree
---

Pick up a story and start working. Argument: "$ARGUMENTS" (story name or empty to show options).

## Step 0: Load Cadence Config

Before anything else, load per-project overrides:

1. Find `CLAUDE.md` at the repo root
2. Run via Bash: `node "${CLAUDE_SKILL_DIR}/parse-cadence-config.mjs" <path-to-CLAUDE.md>`
3. Parse JSON: `{ config, warnings, effective }`
4. Log warnings + applied config to the user
5. Apply to downstream:
   - `effective["pickup.stuck_threshold"]` — override the 3-failure threshold that triggers `hacker`
   - `effective["agents.disable"]` — if `hacker` is listed here, the stuck-recovery protocol falls back to manual user escalation (still stops after threshold, just doesn't Task-invoke)

Missing parser / config file → proceed with defaults.

## Step 1: Find and Select Story

1. Find the project's vault path from the repo's CLAUDE.md under `## Obsidian Project`
2. Read `Sprint/Board.md`

**If no argument given:**
- List all items in "Ready" column with their points and priority
- Ask the user which story to pick up

**WIP limit:** If there are already 3 items in "In Progress", warn the user before proceeding.

## Step 2: Read Story and Specs

When a story is selected (e.g. STORY-auth-login):

1. Read the story file at `Backlog/Stories/STORY-<name>.md`
2. Read any linked specs in `Specs/Features/` and `Specs/Technical/`
3. Extract from the story:
   - Acceptance criteria
   - Testing strategy (test types, framework, coverage target)
   - Specialist context (project type, domain, recommended agents, domain rules, pitfalls)
   - Task list

## Step 3: Load Specialist Context

### If specialist context exists in story:
Read the story's `## Specialist Context` section. It contains:
- **Project type** and **domain** — what kind of project this is
- **Specialist agents for development** — which agents to invoke during coding
- **Domain rules** — constraints to follow (populated from domain plugin's specialist config)
- **Known pitfalls** — things to avoid

Load the recommended specialists. If the story references domain-specific agents, those agents are available because the domain plugin is installed.

### If specialist context is missing (legacy stories):
Run project type detection (same as story creation Step 2) using ALL discovery sources:
- Check for language/framework indicators (go.mod, package.json, pyproject.toml, etc.)
- **Scan loaded rules** in `~/.claude/rules/` for domain routing files — check their detection criteria against this project. If the project matches, load that domain's development triggers, review agents, and rules.
- Search for installed plugin `specialists.md` files
- Check project CLAUDE.md for `## Specialists` section
- Note: "This story was created without specialist context — auto-detected as [type]. Domain routing loaded from [source]."

### Always available (built-in):
These agents are always available regardless of domain:
- `code-reviewer` — general code quality
- `security-reviewer` — security analysis
- `tdd-guide` — TDD enforcement
- `architect` — design decisions
- `planner` — implementation planning
- `go-reviewer` — Go code (if Go files present)
- `python-reviewer` — Python code (if Python files present)

## Step 4: Consult Prior Learnings

Check TWO sources for relevant knowledge: the shared `_Knowledge/` base and the project's `Learning/` folder.

### 4a: Shared Knowledge Base (`_Knowledge/`)

1. Read `C:\Obsidian_Vaults\_Knowledge\Index.md` to scan the cross-project catalog
2. Identify the story's domains (from specialist context or project type detection)
3. Read entries under matching domain sections, prioritizing by severity:
   - **Critical/High** entries matching this story's domain — ALWAYS include in brief
   - **Medium** entries — include if directly relevant to the technologies being used
4. For each relevant entry, read the file to get the full context (problem, fix, detection method)
5. **Staleness check**: If an entry's `last_verified` frontmatter date is > 90 days old, flag it:
   - "This entry hasn't been verified recently — confirm before relying on it"
   - After the story completes, the learn skill will update `last_verified` if the entry is still valid

### 4b: Project-Specific Learnings (`Learning/`)

1. Read `Learning/Index.md` to scan the project catalog
2. **Search Patterns**: Check `Learning/Patterns/` for anti-patterns matching this story's domain
   - Match by domain tag in pattern files
   - Look for patterns related to the technologies this story will use
3. **Search Integration Guides**: Check `Learning/Integrations/` for guides on technologies this story will use
   - Flag guides with "Confidence: Low" — these may need updating
4. **Search Writeups**: Check `Learning/Writeups/` for relevant prior deep-dives
   - Look for writeups in the same domain as this story

### Include in development brief (Step 7):

```
### Prior Learnings

#### Cross-project (_Knowledge/)
- GOTCHA-<name>: [summary] — AVOID THIS (critical)
- PATTERN-<name>: [summary] — recommended approach
- GUIDE-<name>: [summary] — reference for [technology]

#### Project-specific (Learning/)
- PATTERN-<name>: [summary] — project convention
- WRITEUP-<name>: [summary] — relevant context
```

If no relevant learnings found in either location, note: "No prior learnings for this domain yet."

## Step 5: Verify Testing Infrastructure

Before entering the worktree, check that the testing infrastructure is ready:

1. **Detect test framework**: Look for `jest.config.*`, `vitest.config.*`, `pytest.ini`, `go.mod` (for `go test`), etc.
2. **Check test scripts**: Look in `package.json` scripts for `test`, `test:unit`, `test:integration`, `test:e2e`
3. **Check coverage tooling**: Look for `c8`, `istanbul`, `coverage` in config or deps

Report test infrastructure status:
- "Test framework: [name] (ready)" or "Test framework: not found — will need setup"
- "Coverage tool: [name] (ready)" or "Coverage tool: not configured"

## Step 6: Enter Worktree and Start Work

1. Move the item from "Ready" to "In Progress" on `Sprint/Board.md`
2. Update the story's **Status** to `In Progress`
3. Use `EnterWorktree` with name `STORY-<name>` to create an isolated workspace
4. Inside the worktree, rename the branch: `git branch -m feature/STORY-<name>`
5. Symlink gitignored files from main repo (`.env`, `.env.local`, etc.)

## Step 7: Present Development Brief

Report to the user with a structured development brief:

```
## STORY-<name>: <Title>

### Acceptance Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]
...

### Testing Strategy (TDD ENFORCED)
Coverage target: 80%+
Workflow: Write tests FIRST → Run (should FAIL) → Implement → Run (should PASS) → Refactor

Test types required:
- Unit tests: [list from story]
- Integration tests: [list from story]
- [domain-specific test types from story]

### Specialist Context
Project type: [type]
Domain: [domain plugin name, if any]
Available specialists: [list from story]
Domain rules:
- [rule 1]
- [rule 2]
Known pitfalls:
- [pitfall 1]
- [pitfall 2]

### Prior Learnings
- [relevant patterns, guides, writeups from vault]

### Tasks
- [ ] [task 1]
- [ ] [task 2]
...
```

## Step 8: Begin Implementation (TDD Workflow)

Start implementation following TDD discipline:

### Phase 1: RED — Write Tests First
1. For each task in the story, write the corresponding tests BEFORE implementation:
   - Unit tests for functions/components
   - Integration tests for API/DB/cross-module interactions
   - Domain-specific tests as defined in the story's testing strategy
2. Run tests — they should all FAIL (this confirms they're testing the right thing)
3. Commit test files: `test(scope): add tests for STORY-<name> (RED phase)`

### Phase 2: GREEN — Implement to Pass
1. Implement the minimum code to make tests pass
2. Follow specialist recommendations and domain rules from the story's context
3. After each component, run tests to verify progress
4. Consult specialist agents when encountering domain-specific decisions — check the story's "Specialist agents for development" table for trigger conditions
5. Commit working code: `feat(scope): implement [component] for STORY-<name>`

### Phase 3: IMPROVE — Refactor
1. Refactor for clarity, DRY, and maintainability
2. Ensure tests still pass after refactoring
3. Run coverage check — must be >= 80%
4. If coverage is below 80%, add missing tests

### During Development — Specialist Agent Usage

Proactively invoke specialist agents at these trigger points:

**Built-in triggers (always active):**

| Trigger | Agent | Purpose |
|---------|-------|---------|
| Writing API endpoints | `security-reviewer` | Check auth, input validation, rate limiting |
| Writing database queries | `security-reviewer` | Check SQL injection, query optimization (no dedicated database-reviewer in runtime built-ins) |
| Making architectural decisions | `architect` | Validate design trade-offs |
| Writing Go code | `go-reviewer` | Check idiomatic patterns, error handling |
| Writing Python code | `python-reviewer` | Check PEP 8, type hints, Pythonic patterns |
| Stuck on implementation (1-2 failures) | `planner` | Re-plan approach with specialist input |
| Genuinely stuck (3+ failures on same issue) | `hacker` | Question constraints, find bypass / reframe options |

**Domain-specific triggers (from ALL discovery sources — not optional):**
Check BOTH of these sources for development agent triggers:
1. The story's `## Specialist Context` — development agent trigger table
2. Loaded rules in `~/.claude/rules/` — domain routing files with development trigger tables

Sources are additive. A domain routing file applies even if the story has no specialist context. If a trigger condition is met in EITHER source, invoke the specified domain agent. These are not optional.

### Stuck-Recovery Protocol

After 3+ failures on the same problem with variations of the same approach, STOP and Task → `hacker` with:
- The stuck description (what was being attempted)
- Full attempts log (each approach and its failure mode)
- The story's CONSTRAINTS (from Structured Specification)
- The story's GOAL

The hacker agent returns ranked alternatives: bypass options, reframe options, and an escalation path if every option has unacceptable cost. NEVER auto-apply hacker output — surface the options to the user and get explicit direction before changing approach. This is the difference between productive redirection and reckless rewrite.
