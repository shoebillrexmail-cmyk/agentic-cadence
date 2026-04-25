---
name: cadence-done
description: Complete the current story — verify acceptance criteria, update docs, push, create PR, run review. Use when the user says they're done with a story or wants to ship.
---

# Complete Story

Complete the current story and create a pull request.

## Steps

1. Find the vault path from AGENTS.md under `## Obsidian Project`
2. Determine the current story from the branch name (`feature/STORY-<name>`)
3. **Worktree awareness** — the extension auto-routes all bash commands to the active worktree.
   Commands like `git push`, `git diff`, `npm test` already run inside the worktree.
   No manual `cd` needed.
3. Read the story file to get acceptance criteria

### Verification
- Check off completed tasks in the story file
- Verify acceptance criteria are met (review code changes against each criterion)
- If criteria NOT met, warn user and list what's missing

### If Ready:

1. **Documentation gate** — check and update repo documentation:
   a. `git diff develop...HEAD --name-only` to see what changed
   b. Update `README.md`, `CHANGELOG.md`, API docs as needed
   c. Commit: `docs(scope): update documentation for STORY-<name>`
   d. If story adds user-visible behavior, create a backlog task for user-facing docs

2. Stage and commit remaining changes (with `Story: STORY-<name>`)

3. Push: `git push -u origin feature/STORY-<name>`

4. Create PR targeting `develop`:
   ```
   gh pr create --base develop --title "STORY-<name>: <summary>" --body "..."
   ```

5. Move item from "In Progress" to "In Review" on `Sprint/Board.md`
6. Update story's **Status** to `In Review`
7. Update story's **PR** field with the URL

8. **Trigger automated review**: Tell the user to run `/skill:cadence-review` or proceed with review steps:
   - Detect changed files and project type
   - Run code review and security review
   - If CRITICAL/HIGH findings: fix, commit, re-review (max 3 cycles)
   - Hard gates: tests must pass, no CRITICAL security findings

9. **Learning extraction**: Run `/skill:cadence-learn` to extract learnings:
   - Classify as cross-cutting (`_Knowledge/`) or project-specific (`Learning/`)
   - Generate gotchas, patterns, guides, writeups
   - Update indexes

10. After review passes, move to "Done" on Sprint Board

### Worktree Cleanup

After the PR is merged (ask user to confirm merge first), clean up the worktree:

Run:
```
/worktree remove <story-name>
```

This removes the worktree directory, deletes the merged feature branch, and deactivates worktree routing.

Ask the user: "Worktree cleaned up. Continue working in the main repo, or pick up another story?"
