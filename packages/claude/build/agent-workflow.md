---

## Mandatory Agent Workflow

### 1. Before Starting Any Work
1. Read `Sprint/Board.md` — check what's in "Ready" and "In Progress"
2. Read `Backlog/Product-Backlog.md` — understand the pipeline
3. Report current state to the user
4. Only pick up work from the Sprint Board's "Ready" column

### 2. Picking Up a Story
1. Move the item from "Ready" to "In Progress" on `Sprint/Board.md`
2. Update the linked story's **Status** to `In Progress`
3. Read the story file and any linked specs before coding
4. **Load specialist context** from the story's `## Specialist Context` section:
   - Identify project type, domain, and recommended specialist agents
   - Load domain rules and development agent triggers from the domain's specialist config
   - Note known pitfalls to avoid during implementation
   - If specialist context is missing (legacy story), auto-detect project type and discover domain plugins
5. **Consult prior learnings** from TWO sources:
   - **Shared knowledge base** (`_Knowledge/Index.md`): Read entries matching this story's domain. Critical/High entries are always included. Flag entries with `last_verified` > 90 days.
   - **Project learnings** (`Learning/Index.md`): Check `Learning/Patterns/`, `Learning/Integrations/`, `Learning/Writeups/`
6. **Verify testing infrastructure**: Check test framework, coverage tools, test scripts exist
7. Respect WIP limit: max 2-3 items in "In Progress" at once
8. **MANDATORY — Enter a worktree before writing any code**:
   a. If already in a worktree, skip
   b. Use `EnterWorktree` with name `STORY-<name>`
   c. Rename the branch: `git branch -m feature/STORY-<name>`
   d. Only skip if user explicitly says "don't use a worktree"
9. Present development brief: acceptance criteria, testing strategy, specialist context, tasks

### 3. While Working — TDD and Specialist Enforcement
- **TDD is mandatory**: Write tests FIRST (RED), implement (GREEN), refactor (IMPROVE)
- Follow the story's `## Testing Strategy`
- Check off completed tasks (`- [x]`) in the story file
- **Invoke specialist agents at trigger points**:
  - **Built-in**: API endpoints → `security-reviewer`, DB queries → `database-reviewer`, Go → `go-reviewer`, Python → `python-reviewer`, architecture → `architect`
  - **Domain-specific**: Check specialist context for trigger conditions
- If you discover new work, add to `Backlog/Product-Backlog.md` under "Icebox"
- If you need to investigate, create `Research/SPIKE-<topic>.md`
- **Commits** reference the story: `feat(scope): description\n\nStory: STORY-<name>`
- **Test commits** come first: `test(scope): add tests for [component]\n\nStory: STORY-<name>`

### 4. Completing Work
1. **Documentation gate** (before PR):
   a. `git diff develop...HEAD --name-only` for what changed
   b. Update repo docs: README, CHANGELOG, API docs, config docs
   c. Commit: `docs(scope): update documentation for STORY-<name>`
   d. If story adds user-visible behavior, create backlog task for user-facing docs
2. Move item from "In Progress" to "In Review" on `Sprint/Board.md`
3. Update the story's **Status** to `In Review`
4. **Git**: Push and create PR → `develop`:
   ```
   git push -u origin feature/STORY-<name>
   gh pr create --base develop --title "STORY-<name>: <summary>"
   ```
5. Update story's **PR** field
6. **Automated Review Cycle**: Run `/cadence:review`
7. **Learning extraction**: Run `/cadence:learn`
8. Ask: "Story is done. Exit worktree?"

### 5. When User Reports a Bug

**Critical/blocking:**
1. Create story in `Backlog/Stories/STORY-fix-<desc>.md` (Priority: ⏫)
2. Add to `Sprint/Board.md` under "Ready" (bypass backlog)
3. Pick up immediately → enter worktree → branch: `hotfix/STORY-fix-<desc>`
4. Fix, test, follow normal completion flow

**Non-critical:**
1. Create story, add to Backlog under "Needs Refinement"
2. Ask user: "Fix now or add to backlog?"

**Hotfix (production):**
1. Create story, enter worktree from master
2. Branch: `hotfix/STORY-fix-<desc>`
3. Fix, PR → master AND cherry-pick to develop

### 6. When User Asks to Create New Work
1. Detect project type and discover domain plugins
2. Consult specialists for approach feedback
3. Create story with specialist context and testing strategy
4. Create linked spec
5. Add to Backlog under "Needs Refinement"

### 7. Handling Unplanned Work
**Small (< 30 min):** Create minimal story → add to Sprint Board → enter worktree → complete
**Medium/Large:** Create full story → add to Backlog → ask about sprint

### 8. When User Asks About Status
- Read Sprint Board and Backlog
- Report items per column, velocity, active branches

---

## Git Worktrees (Parallel Sessions)

Git worktrees allow multiple Claude Code sessions to work on different stories simultaneously.

```
C:\Github\my-project\                  ← main repo (develop branch)
C:\Github\my-project-worktrees\
  ├── STORY-auth-login\                ← worktree on feature/STORY-auth-login
  ├── STORY-payment-flow\              ← worktree on feature/STORY-payment-flow
  └── STORY-user-settings\             ← worktree on feature/STORY-user-settings
```

### Session ↔ Story Mapping
1. Session reads CLAUDE.md to find Obsidian project
2. Branch name `feature/STORY-<name>` maps to `Backlog/Stories/STORY-<name>.md`
3. Session reads story and linked specs before starting work
4. Board updates happen on shared vault (not branch-specific)

### Gitignored Files (IMPORTANT)
Git worktrees only contain tracked files. After entering a worktree, symlink gitignored files from the main repo:

```bash
MAIN_REPO=$(git -C "$(git rev-parse --git-common-dir)" rev-parse --show-toplevel 2>/dev/null || echo "")
for f in .env .env.local .env.development .env.test; do
  [ -f "$MAIN_REPO/$f" ] && [ ! -f "$f" ] && ln -s "$MAIN_REPO/$f" "$f"
done
```
