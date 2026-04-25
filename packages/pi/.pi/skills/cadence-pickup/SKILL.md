---
name: cadence-pickup
description: Pick up a story from the sprint board — load specialist context, prior learnings, enforce TDD, start working. Use when the user wants to start working on a story.
---

# Pick Up Story

Pick up a story and start working. Argument: story name (or empty to show options).

## Step 0: Load Cadence Config

Before anything else, load per-project overrides:

1. Find `AGENTS.md` at repo root
2. Shell: `node {baseDir}/parse-cadence-config.mjs <path-to-AGENTS.md>`
3. Parse JSON: `{ config, warnings, effective }`
4. Log warnings + applied config
5. Apply:
   - `effective["pickup.stuck_threshold"]` — override the 3-failure threshold for triggering `hacker` role
   - `effective["agents.disable"]` — if `hacker` listed, fall back to manual user escalation

Missing parser / config file → proceed with defaults.

## Step 1: Find and Select Story

1. Find the vault path from AGENTS.md under `## Obsidian Project`
2. Read `Sprint/Board.md`

**If no argument:** List all items in "Ready" column with points and priority. Ask user which to pick.

**WIP limit:** If 3+ items in "In Progress", warn before proceeding.

## Step 2: Read Story and Specs

1. Read the story file at `Backlog/Stories/STORY-<name>.md`
2. Read any linked specs
3. Extract: acceptance criteria, testing strategy, specialist context, tasks

## Step 3: Load Specialist Context

Read the story's `## Specialist Context` section for:
- Project type and domain
- Specialist agents for development
- Domain rules and known pitfalls

If missing (legacy story), auto-detect project type and discover specialists from:
- Language/framework indicators
- Loaded prompt files
- Installed skills
- Project AGENTS.md

## Step 4: Consult Prior Learnings

### Shared Knowledge Base (`_Knowledge/`)
1. Read `_Knowledge/Index.md`
2. Identify matching domains from specialist context
3. Prioritize Critical/High entries — ALWAYS include in brief
4. Flag entries with `last_verified` > 90 days as potentially stale

### Project Learnings (`Learning/`)
1. Read `Learning/Index.md`
2. Search `Learning/Patterns/`, `Learning/Integrations/`, `Learning/Writeups/`

## Step 5: Verify Testing Infrastructure

1. Detect test framework (`jest.config`, `vitest.config`, `pytest.ini`, `go.mod`)
2. Check test scripts in `package.json`
3. Check coverage tooling

## Step 6: Move Story and Activate Worktree

1. Move item from "Ready" to "In Progress" on `Sprint/Board.md`
2. Update story's **Status** to `In Progress`
3. **Check if the extension already created the worktree** (when `/pickup` was called with a story name, the extension creates the worktree BEFORE delegating to this skill, and all bash calls are auto-routed to it):
   ```bash
   # Check if the extension has an active worktree via git worktree list
   # The extension intercepts bash and prepends cd <worktree> automatically,
   # so all commands here already run in the worktree directory.
   echo "Worktree active — bash commands are auto-routed by the extension."
   ```
   If the worktree does NOT exist yet (e.g. the user typed `/skill:cadence-pickup` directly without the extension):
   ```bash
   git fetch origin
   REPO_NAME=$(basename -s .git "$(git remote get-url origin 2>/dev/null || echo 'repo')" 2>/dev/null || echo "repo")
   WORKTREE_DIR="../${REPO_NAME}-worktrees/STORY-<name>"
   BASE_BRANCH=$(git rev-parse --verify develop 2>/dev/null && echo 'develop' || echo 'master')
   git worktree add -b feature/STORY-<name> "$WORKTREE_DIR" "$BASE_BRANCH"
   
   # Symlink gitignored files
   MAIN_REPO=$(git -C "$(git rev-parse --git-common-dir)" rev-parse --show-toplevel 2>/dev/null || echo "")
   for f in .env .env.local .env.development .env.test; do
     [ -f "$MAIN_REPO/$f" ] && [ ! -f "$f" ] && ln -s "$MAIN_REPO/$f" "$f"
   done
   ```

4. **The extension auto-routes all bash commands** to the worktree directory. You do NOT need to `cd` — the extension intercepts every `bash` tool call and prepends `cd <worktree-path> &&` automatically. Commands like `npm test`, `git status`, `git push` all run inside the worktree.

5. **Report** the worktree path and note that bash is auto-routed:

## Step 7: Present Development Brief

```
## STORY-<name>: <Title>

### Acceptance Criteria
- [ ] [...]

### Testing Strategy (TDD ENFORCED)
Coverage target: 80%+
Workflow: Write tests FIRST → Run (should FAIL) → Implement → Run (should PASS) → Refactor

### Specialist Context
Project type: [...]
Domain rules: [...]
Known pitfalls: [...]

### Prior Learnings
- [relevant entries from vault]

### Tasks
- [ ] [...]
```

## Step 8: Begin TDD Implementation

### Phase 1: RED — Write Tests First
1. Write tests for each task BEFORE implementation
2. Run tests — they should FAIL
3. Commit: `test(scope): add tests for STORY-<name> (RED phase)`

### Phase 2: GREEN — Implement to Pass
1. Implement minimum code to make tests pass
2. Follow specialist recommendations and domain rules
3. Commit: `feat(scope): implement [component] for STORY-<name>`

### Phase 3: IMPROVE — Refactor
1. Refactor for clarity, DRY, maintainability
2. Ensure tests still pass
3. Coverage >= 80%

## Stuck-Recovery Protocol

After 3+ failures on the same problem with variations of the same approach, STOP and apply the `hacker` role (prompt in `.pi/prompts/shared-agents.md`) with:
- Stuck description (what was being attempted)
- Full attempts log (each approach + failure mode)
- Story CONSTRAINTS (from Structured Specification)
- Story GOAL

Hacker returns ranked alternatives: bypass options, reframe options, or an escalation path. NEVER auto-apply — surface options to the user and get explicit direction before changing approach.
