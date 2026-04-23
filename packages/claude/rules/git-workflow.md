# Git Workflow



### Branch Strategy

```
master (production releases)
  ↑ merge via PR (release)
develop (integration branch)
  ↑ merge via PR (story complete)
feature/STORY-<name> (one branch per story)
```

### Branch Types

| Branch | Purpose | From | Into | Naming |
|--------|---------|------|------|--------|
| `master` | Production | — | — | `master` |
| `develop` | Integration | — | `master` | `develop` |
| `feature/*` | Story work | `develop` | `develop` | `feature/STORY-<name>` |
| `hotfix/*` | Urgent fix | `master` | `master` + `develop` | `hotfix/<desc>` |
| `release/*` | Stabilization | `develop` | `master` + `develop` | `release/vX.Y.Z` |

### Rules
- NEVER commit directly to `master` or `develop`
- Every story gets its own feature branch
- Feature branches are short-lived
- Branch names match story names

### Commit Message Format

```
<type>(<scope>): <description>

<optional body>

Story: STORY-<name>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

### Branch → Environment Mapping

| Branch | Environment |
|--------|-------------|
| `feature/*`, `hotfix/*` | Preview |
| `develop` | Staging / Testnet |
| `release/*` | Release Candidate |
| `master` | Production / Mainnet |

### Sync Before Work

Always sync before starting work:

```bash
git fetch origin
git merge --ff-only origin/develop 2>/dev/null || true
```

---


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
