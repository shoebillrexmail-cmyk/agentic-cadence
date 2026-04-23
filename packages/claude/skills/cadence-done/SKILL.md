---
description: Complete the current story — push, create PR, update board
---

Complete the current story and create a pull request.

1. Find the project's vault path from the repo's CLAUDE.md under `## Obsidian Project`
2. Determine the current story from the branch name (`feature/STORY-<name>`)
3. Read the story file to get acceptance criteria

**Verification:**
- Check off all completed tasks in the story file
- Verify acceptance criteria are met (review the code changes against each criterion)
- If criteria are NOT met, warn the user and list what's missing

**If ready:**

1. **Documentation gate** — before creating the PR, check and update repo documentation:
   a. Determine what changed: `git diff develop...HEAD --name-only`
   b. **Update repo docs** that are directly affected by the code changes:
      - `README.md` — update if new features, changed setup steps, new dependencies, or changed CLI usage
      - `CHANGELOG.md` — add entry under `[Unreleased]` for the story's changes (if changelog exists)
      - API docs — update if endpoints were added/changed/removed
      - Config/env docs — update if new env vars or config options were introduced
      - Any inline doc comments that are now stale due to the changes
   c. Commit doc updates: `docs(scope): update documentation for STORY-<name>`
   d. **Assess user-facing doc impact** — if the story introduces a new feature, changes user-visible behavior, modifies UI flows, adds/changes CLI commands, or changes API contracts:
      - Create a backlog story: `Backlog/Stories/STORY-docs-<name>.md` with:
        - Title: "Update user documentation for [feature name]"
        - Description of what user-facing docs need updating (user guides, help pages, tutorials, API reference, etc.)
        - Priority: 🔼 Medium
        - Status: `Needs Refinement`
      - Add to `Backlog/Product-Backlog.md` under "Needs Refinement"
      - Note in the PR body: "User-facing docs task created: STORY-docs-<name>"
   e. If the change is purely internal (refactoring, test-only, infrastructure) — skip the user-facing docs task

2. Stage and commit any remaining changes (with `Story: STORY-<name>` in the message)
3. Push the feature branch: `git push -u origin feature/STORY-<name>`
4. Create a PR targeting `develop`:
   ```
   gh pr create --base develop --title "STORY-<name>: <summary>" --body "..."
   ```
   Include in PR body: story link, acceptance criteria checklist, test plan, and user-facing docs task reference (if created)
5. Move item from "In Progress" to "In Review" on `Sprint/Board.md`
6. Update the story's **Status** to `In Review`
7. Update the story's **PR** field with the PR URL
8. **Trigger automated review cycle**: Run `/cadence:review` to launch review agents on the changes. This runs a review/fix loop (default max 3 cycles):
   - Detects project type and changed file categories
   - Launches appropriate review agents in parallel (code-reviewer, security-reviewer, plus language and domain-specific agents from installed plugins)
   - If CRITICAL/HIGH findings: fixes them, commits, re-reviews (incremental — only re-runs agents that had findings)
   - If regressions detected (fixed issue reappeared): elevated to CRITICAL
   - Cycle repeats until PASS or max cycles reached
   - On PASS: moves story to Done automatically
   - On max cycles exceeded: reports remaining issues, asks user how to proceed
9. **Learning extraction**: Run `/cadence:learn` to extract learnings from the completed story:
   - Analyzes what changed, what was caught in review, what specialist feedback was key
   - Classifies each learning as **cross-cutting** or **project-specific**:
     - **Cross-cutting** (applies to any project using this tech) → saved to `C:\Obsidian_Vaults\_Knowledge\` (Gotchas/, Patterns/, Guides/, Writeups/)
     - **Project-specific** (only relevant to this codebase) → saved to the project's `Learning/` folder
   - Generates learning documents:
     - **Gotchas** — concrete "don't do X because Y" entries (usually cross-cutting)
     - **Patterns** — anti-patterns and best practices discovered during review
     - **Integration Guides** — when new technologies/services were integrated
     - **Writeups** — educational deep-dives on complex problems solved
   - Updates `_Knowledge/Index.md` and/or `Learning/Index.md` as appropriate
   - Links learnings back to the story
   - Skipped for trivial/routine changes with no novel learnings
10. After learning extraction, ask: "Story is done. Exit worktree, or continue with another story?"
