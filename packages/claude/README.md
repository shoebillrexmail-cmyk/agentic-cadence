# Agentic Cadence for Claude Code

The Claude Code runtime of Agentic Cadence. 12 skills, 20 shared agents, Kanban boards in Obsidian, worktree-based story isolation, and a 4-stage automated review cycle.

For framework-wide concepts (monorepo structure, shared agents, domain plugins), see the [repo-root README](../../README.md).

---

## Install

```bash
# From the repo root
cd packages/claude
bash install.sh
```

The installer:
1. Runs `npm run build:claude` if outputs are missing
2. Asks for your Obsidian vault location (default `C:\Obsidian_Vaults` on Windows, `~/Obsidian_Vaults` elsewhere)
3. Copies workflow rules into `~/.claude/rules/common/`
4. Copies 13 vault templates into `<vault>/_Templates/`
5. Creates `<vault>/_Dashboard.md` if missing
6. Reminds you to add the vault path to `additionalDirectories` in `~/.claude/settings.json`

### Install as a Claude Code plugin

After `install.sh`, register the plugin so `/cadence:*` commands become available:

```bash
claude --plugin-dir /absolute/path/to/agentic-cadence/packages/claude
```

Or publish via the [plugin marketplace](../.claude-plugin/marketplace.json).

### Prerequisites

- [Claude Code](https://code.claude.com) CLI
- Node 18+ (the config parser is shipped with each skill)
- [Obsidian](https://obsidian.md) with the two community plugins below:
  - **Kanban** by *mgmeyers* — renders `Sprint/Board.md` and `Product-Backlog.md` as boards (`/cadence:board`, `/cadence:sprint`, `/cadence:pickup` all write Kanban-plugin markdown)
  - **Tasks** by *Clare Macrae* — interprets the `- [ ] ... 📅 YYYY-MM-DD ⏫` syntax emitted inside stories and on boards
- Git + [GitHub CLI](https://cli.github.com) (`gh`) — used by `/cadence:done` for PR creation

### Vault location

The vault path is **not hardcoded** — `install.sh` asks for it and defaults to `C:\Obsidian_Vaults` on Windows or `~/Obsidian_Vaults` elsewhere. Override non-interactively by exporting `OBSIDIAN_VAULT_PATH` before running the installer.

The installer rewrites the path into `~/.claude/rules/common/obsidian-workflow.md`. Skills reference the vault root via the `<Obsidian_Vaults>` placeholder and resolve it from that rule file at runtime. Each project's own `CLAUDE.md` then records absolute paths under `## Obsidian Project` — that's what skills read for project-scoped files.

Two things must line up for skills to reach the vault:

1. `~/.claude/settings.json` → `permissions.additionalDirectories` must include the vault path (the installer prints the exact JSON snippet if missing).
2. Each project's `CLAUDE.md` has an `## Obsidian Project` block pointing at `<vault>/<ProjectName>/Sprint/Board.md` etc.

---

## Commands

All 12 skills, invoked as `/cadence:<name>`:

| Command | When to use |
|---------|-------------|
| `/cadence:init <project>` | Initialize a new project — creates the vault folder structure and the Cadence Config section in `CLAUDE.md` |
| `/cadence:board` | Show the sprint board and backlog (read-only summary) |
| `/cadence:interview <desc>` | Socratic interview to clarify a vague feature before story creation — produces a clarified scope |
| `/cadence:story <desc>` | Create a new user story — runs specialist consultation, ontology gate, and generates the structured spec |
| `/cadence:sprint` | Start, archive, or retro a sprint |
| `/cadence:pickup [story]` | Pick up a story from Ready — **creates a worktree**, loads specialists + prior learnings, presents dev brief |
| `/cadence:done` | Complete the current story — docs gate, push, create PR, run `/cadence:review` |
| `/cadence:review` | Run the 4-stage automated review with fix/re-review cycle |
| `/cadence:learn` | Extract learnings from a completed story into `_Knowledge/` or `<project>/Learning/` |
| `/cadence:spike <question>` | Time-boxed research spike |
| `/cadence:sync` | Sync an existing vault project to current cadence conventions |
| `/cadence:release` | Cut a release — version bump, CHANGELOG, tag, merge to master, GitHub Release |

---

## How the agents work

When you run a skill, the skill orchestrates multiple **subagents** via the `Task` tool. Each subagent is defined in `packages/claude/agents/<name>.md` with its own YAML frontmatter (model, tool allowlist, description).

Agents are **read-only by default** — only `cadence-pm` can write vault files. Security comes from the tool allowlist, not trust.

### Subagent model tiers

| Tier | When used | Agents |
|------|-----------|--------|
| **Opus** | Deep reasoning + high-leverage decisions | `ontologist`, `seed-architect`, `ontology-analyst`, `contrarian`, `semantic-evaluator`, `advocate`, `judge`, `hacker`, `design-auditor` (Sonnet today, Opus candidate) |
| **Sonnet** | Default — balanced reasoning, local impact | `pattern-auditor`, `qa-judge`, `integration-validator`, `researcher`, `simplifier`, `cadence-pm`, plus all domain specialists |
| **Haiku** | Mechanical bookkeeping / structured eliciting | `socratic-interviewer`, `breadth-keeper`, `seed-closer`, `evaluator` |

Tier assignments live in `shared/build.mjs` and are documented in `STORY-agent-model-tiers` (committed).

### When each agent fires

| You ran… | Skill kicks off these agents |
|----------|-----------------------------|
| `/cadence:interview` | `ontologist` + `breadth-keeper` (framing) → rounds 2-4 cycle through `socratic-interviewer`, `ontologist`, `breadth-keeper`, `simplifier` as needed → `seed-closer` → final `ontologist` gate |
| `/cadence:story` | Detect project type, consult specialists → `seed-architect` + (optional) `contrarian` + (optional) `ontology-analyst` → `ontologist` gate |
| `/cadence:pickup` | Loads specialist context from story; no agents by default (specialists fire during dev at trigger points) |
| `/cadence:review` | See review pipeline below |
| `/cadence:done` | Runs `/cadence:review` internally after PR creation |

---

## Review pipeline (what `/cadence:review` actually does)

```
Stage 1: Mechanical        (build + lint + tests + coverage)
Stage 2: Semantic          (semantic-evaluator ∥ ontologist post-impl)
Stage 3: Domain review     (code-reviewer, security-reviewer, qa-judge, go/python-reviewer,
                            domain agents, + optional pattern-auditor, integration-validator,
                            contrarian, design-auditor)
Stage 4: Consensus         (conditional — advocate → judge → consensus-reviewer)
Aggregate: evaluator       (findings ledger, verdict, stages-to-re-run)
```

**Verdicts and actions:**
- `PASS` → Hard Gates (tests, no CRITICAL, coverage >= 80%) → move story to Done
- `FIX_REQUIRED` / `BLOCK` → Structured Repair R1 (localize) / R2 (patch, up to 3 candidates) / R3 (validate) → commit → re-cycle

**Stage 4 triggers** (any one fires): `--consensus` flag · ≥2 regressions in prior ledger · ≥2 agents with overlapping findings at different severities · story marked `high-risk: true` or CONSTRAINTS contain "mainnet" / "production" / "payments" / "auth" / "keypair" / "signing" / "funds" · any CRITICAL Stage-3 finding.

**`design-auditor` special handling**: findings carry a `resolution_hint`:
- `UPDATE_CODE` → falls through to Structured Repair (code gets fixed)
- `UPDATE_DESIGN` → skill offers to edit `design.md` directly (user can veto)
- `ASK_USER` → cycle pauses; agent's prompt is surfaced verbatim; user answers `code` / `design` / `skip`

This ensures we never silently assume the code is wrong when `design.md` might just be stale.

**Stuck recovery**: if the same finding regresses across 2 cycles, `hacker` is invoked with alternatives (bypass / reframe / relax-constraint). Never auto-applied — always surfaced to user.

---

## Worktrees (non-negotiable)

Every story gets its own worktree. The worktree IS the isolation boundary — it lets parallel sessions work on different stories without conflict.

```
C:\Github\my-project\                  ← main repo (develop)
C:\Github\my-project-worktrees\
  ├── STORY-auth-login\                ← worktree on feature/STORY-auth-login
  ├── STORY-payment-flow\              ← worktree on feature/STORY-payment-flow
  └── STORY-user-settings\             ← worktree on feature/STORY-user-settings
```

### How

`/cadence:pickup` auto-calls `EnterWorktree` for the story. If you forget, the obsidian-workflow rule enforces it — any code work must start with `EnterWorktree` unless the user explicitly opts out.

**Gitignored files**: worktrees only contain tracked files. After `EnterWorktree`, the skill symlinks common gitignored configs (`.env`, `.env.local`, `.env.development`, `.env.test`) from the main repo so builds and tests don't break.

Settings that make worktrees work:

```json
{
  "permissions": {
    "additionalDirectories": ["/path/to/Obsidian_Vaults"]
  },
  "worktree": {
    "symlinkDirectories": ["node_modules", ".venv", ".cache"]
  }
}
```

---

## Hooks

Defined in [`hooks/hooks.json`](hooks/hooks.json):

- **Stop hook** — on session end, runs `hooks/scripts/check-board.js` to warn about stories still In Progress on the sprint board, so you don't forget mid-work.

All hooks reference `${CLAUDE_PLUGIN_ROOT}` so they resolve wherever the plugin is installed.

---

## Cadence Config (per-project overrides)

Add a `## Cadence Config` block to your project's `CLAUDE.md`:

````markdown
## Cadence Config
```yaml
review.max_cycles: 5
review.force_consensus: false
review.design_doc_path: docs/design.md
agents.disable: [simplifier, contrarian]
interview.auto_trigger_on_vague: false
story.skip_interview_for_clear_requests: true
pickup.stuck_threshold: 5
```
````

All 12 skills read this on startup via the colocated `parse-cadence-config.mjs` (resolved via `${CLAUDE_SKILL_DIR}`). Defaults, key list, and safety-critical gates (which can't be disabled) are documented in `shared/core.md`.

---

## Troubleshooting

### `/cadence:story` shows "Parser not found — proceeding with defaults"

You're running an older install. The current version ships `parse-cadence-config.mjs` inside every skill directory and resolves it via `${CLAUDE_SKILL_DIR}`. Re-run `install.sh` or pull + `npm run build` to refresh.

### The socratic-interviewer didn't trigger automatically

By design. Skills are only invoked by explicit slash commands or by another skill chaining into them. `/cadence:story` will auto-trigger an interview for vague descriptions *if* `interview.auto_trigger_on_vague` is true (default). For free-form chat to auto-route to the interview, add a rule to your project `CLAUDE.md` — see the repo README's "Auto-Interview Rule" suggestion.

### A review finding regressed

The evaluator auto-elevates a finding to CRITICAL if it's marked `RESOLVED` in an earlier cycle then reappears. If it regresses twice, `hacker` is invoked with alternatives — the user picks.

### The review keeps hitting the cycle cap

Default `review.max_cycles` is 3. Override with `--max-cycles N` per invocation or set `review.max_cycles` in Cadence Config. For a stubborn story, also consider `--consensus` to force Stage 4 arbitration.

### "This isn't the root problem" (from ontologist)

That's the ontology gate doing its job. Verdicts:
- `SPLIT` → your story treats a symptom — create a root-cause story (you decide which to work on)
- `REWRITE` → fix the scope, re-run
- `BLOCK` → missing prerequisites — create prereq stories first
- `PROCEED` → you're good

---

## Development

```bash
npm run build:claude      # Rebuild the Claude package from shared/
npm test                  # Config parser tests (26 cases)
```

Hand-edit targets:
- `packages/claude/skills/<name>/SKILL.md` — the skill orchestration logic
- `packages/claude/build/*.md` — Claude-specific fragments merged into generated rules
- `shared/agents/<name>.md` — shared agent definitions (regenerated into `packages/claude/agents/`)

**Do NOT hand-edit** `packages/claude/agents/*.md` — the directory is wiped + re-emitted every build. Author in `shared/agents/` and run `npm run build`.

See the [repo-root README](../../README.md) for monorepo-level conventions.
