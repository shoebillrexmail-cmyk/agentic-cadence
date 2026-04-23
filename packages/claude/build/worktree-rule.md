---

## Worktree Rule (NON-NEGOTIABLE — ZERO EXCEPTIONS)

**Every piece of code work MUST happen in a worktree.** Before writing ANY code — even a single line — you MUST call `EnterWorktree` first.

### The Rule
1. Call `EnterWorktree` with the story name
2. Rename the branch to `feature/STORY-<name>` or `hotfix/STORY-<name>`
3. Only then start coding

### This applies regardless of:
- **Story state** — whether the story is new, in progress, in review, or done. State does not matter.
- **Prior sessions** — if a previous session worked on this story without a worktree, YOU still use one.
- **Branch existence** — if the feature branch doesn't exist yet, `EnterWorktree` creates one.
- **Urgency** — urgent bugs, critical hotfixes, "just a quick fix" — ALL get a worktree. No urgency bypass.
- **Where the changes are** — if changes are on develop, on master, or uncommitted. Enter a worktree first.
- **How small the change is** — one line or one thousand lines, worktree first.

### The ONLY exceptions (must be explicitly true):
- You are already inside a worktree (check with: is the cwd inside `.claude/worktrees/`?)
- The user explicitly says "don't use a worktree" or "work on this branch directly"
- The work is documentation-only (zero code file changes)

### After entering a worktree — symlink gitignored files
Git worktrees only include tracked files. Gitignored files like `.env` are NOT copied. After `EnterWorktree`, immediately symlink these from the main repo:

```bash
# Get the main repo root (parent of .claude/worktrees/)
MAIN_REPO=$(git -C "$(git rev-parse --git-common-dir)" rev-parse --show-toplevel 2>/dev/null || echo "")

# Symlink .env and other gitignored config files if they exist in the main repo
for f in .env .env.local .env.development .env.test; do
  [ -f "$MAIN_REPO/$f" ] && [ ! -f "$f" ] && ln -s "$MAIN_REPO/$f" "$f"
done
```

This is MANDATORY after every `EnterWorktree`. Without it, builds and tests fail due to missing environment variables.

### Why this matters
Without worktrees, parallel sessions conflict, develop gets polluted with half-finished work, and there's no clean branch-per-story history. The worktree IS the isolation boundary.

