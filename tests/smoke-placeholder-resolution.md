# Manual Smoke: `<Obsidian_Vaults>` Placeholder Resolution End-to-End

**Owner:** whoever is cutting the PR for [`STORY-claude-skill-vault-placeholder`](../../../Obsidian_Vaults/agentic-cadence/Backlog/Stories/STORY-claude-skill-vault-placeholder.md)
**When to run:** once, before PR merge. Not automated — this is the single piece of evidence that distinguishes this fix from a cosmetic rename.
**Estimated time:** 10 minutes.

---

## Why this can't be a unit test

The unit test suite (`shared/scripts/skill-vault-placeholder.test.mjs`) proves the **literal is gone**. The integration test (`shared/scripts/install-substitution.test.mjs`) proves the installer **rewrites `obsidian-workflow.md`** with the user's chosen vault path. Neither proves the **agent actually resolves the `<Obsidian_Vaults>` placeholder** at skill invocation — that's mental substitution, LLM-lifecycle, not something Node's test runner can validate.

This smoke covers that gap.

## Setup

1. Pick a non-default vault location. Suggested: `D:/SmokeVault-$(date +%s)` on Windows, `/tmp/smoke-vault-$(date +%s)` elsewhere.

2. Run the installer against a throwaway HOME (do NOT overwrite your real `~/.claude/`):

   ```bash
   export HOME=/tmp/smoke-home-$(date +%s)
   mkdir -p "$HOME"
   OBSIDIAN_VAULT_PATH=<chosen-path> bash packages/claude/install.sh
   ```

   - Accept the default vault prompt (it's already set via the env var).
   - Accept the "create directory?" prompt with `Y`.

3. Confirm install:
   - `~/.claude/rules/common/obsidian-workflow.md` exists and contains your custom path, not `C:\Obsidian_Vaults`.
   - `<chosen-path>/_Dashboard.md` exists.
   - `<chosen-path>/_Templates/` exists and is populated.

## The smoke run

Open Claude Code in a scratch repo with a minimal `CLAUDE.md`:

```markdown
## Obsidian Project
- Vault project: smoke-test
- Sprint Board: <chosen-path>/smoke-test/Sprint/Board.md
- Product Backlog: <chosen-path>/smoke-test/Backlog/Product-Backlog.md
- Specs: <chosen-path>/smoke-test/Specs/
- Research: <chosen-path>/smoke-test/Research/
```

Then run, in order:

### 1. `/cadence:init smoke-test`

**Expected:** the agent creates `<chosen-path>/smoke-test/` with the standard subfolder structure — NOT `C:\Obsidian_Vaults\smoke-test\`.

**Fail signal:** agent creates folders at `C:\Obsidian_Vaults\smoke-test\` or refuses because `C:\Obsidian_Vaults\` doesn't exist.

### 2. `/cadence:pickup` with no story

**Expected:** agent reads `<chosen-path>/smoke-test/Sprint/Board.md` and lists "Ready" items (empty at this point). The tool-call trace should show a `Read` against the custom path.

**Fail signal:** agent reads `C:\Obsidian_Vaults\smoke-test\Sprint\Board.md` or reports "file not found" at the default path.

### 3. `/cadence:learn` after writing a trivial fake Done-story

Create `<chosen-path>/smoke-test/Backlog/Stories/STORY-smoke.md` with minimal content, move to Done on the board, then run `/cadence:learn`.

**Expected:** if the agent classifies the learning as cross-cutting, it writes to `<chosen-path>/_Knowledge/...` — NOT `C:\Obsidian_Vaults\_Knowledge\`. The user-facing report string (final paragraph of `/cadence:learn`) should print the resolved path, not the literal `<Obsidian_Vaults>` placeholder.

**Fail signal:** placeholder appears in user-facing output; or learning files land at the default path.

## Recording results

Paste into the PR description:

```markdown
### Smoke test — STORY-claude-skill-vault-placeholder

- Vault: `<chosen-path>`
- HOME: `/tmp/smoke-home-<ts>`
- Installer: PASS / FAIL
- `/cadence:init`: PASS / FAIL
- `/cadence:pickup`: PASS / FAIL
- `/cadence:learn`: PASS / FAIL
- Notable observations: <free text>
```

## Cleanup

```bash
rm -rf "$HOME" "<chosen-path>"
unset HOME OBSIDIAN_VAULT_PATH
```
