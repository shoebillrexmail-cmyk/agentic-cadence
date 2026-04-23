---

## Git Worktrees (Claude Code)

Git worktrees allow multiple Claude Code sessions to work on different stories simultaneously.

### How It Works

```
C:\Github\my-project\                  ← main repo (develop branch)
C:\Github\my-project-worktrees\
  ├── STORY-auth-login\                ← worktree on feature/STORY-auth-login
  ├── STORY-payment-flow\              ← worktree on feature/STORY-payment-flow
  └── STORY-user-settings\             ← worktree on feature/STORY-user-settings
```

Each worktree is a full working directory tied to its own branch.

### Creating a Worktree

**From within Claude (preferred):**
```
You: "Work on STORY-auth-login"
Claude: → EnterWorktree(name: "STORY-auth-login")
       → renames branch to feature/STORY-auth-login
```

**Manual:**
```bash
git worktree add -b feature/STORY-<name> ../my-project-worktrees/STORY-<name> develop
cd ../my-project-worktrees/STORY-<name>
```

### Exiting / Cleaning Up

**From Claude:**
```
You: "Exit the worktree"
Claude: → ExitWorktree(action: "keep")    # preserves branch until PR merges
```

**Manual:**
```bash
git worktree remove ../my-project-worktrees/STORY-<name>
git branch -d feature/STORY-<name>
```

### Worktree Config

Configured in `~/.claude/settings.json`:
```json
"worktree": {
  "symlinkDirectories": ["node_modules", ".venv", ".cache"]
}
```

### Session ↔ Story Mapping
1. Session reads CLAUDE.md to find Obsidian project
2. Branch name maps to story file
3. Board updates happen on shared vault

### Multi-Session Safety
- Each session works in its own worktree — no conflicts
- The Obsidian vault is shared (file-level) — board updates are immediate
- Always `git fetch` before creating a new worktree
