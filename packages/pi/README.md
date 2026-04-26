# Agentic Cadence for Pi

The [Pi](https://shittycodingagent.ai) runtime of Agentic Cadence. 12 skills, 20 shared role definitions, Kanban boards in Obsidian, and the same 4-stage automated review cycle as the Claude Code package.

For framework-wide concepts (monorepo structure, shared agents, domain plugins), see the [repo-root README](../../README.md).

---

## Install

```bash
# Global install
pi install git:github.com/shoebillrexmail-cmyk/agentic-cadence.git

# Or project-local (recommended for multi-project setups)
pi install git:github.com/shoebillrexmail-cmyk/agentic-cadence.git -l
```

Pi picks up:
- 12 skills from [`.pi/skills/`](.pi/skills/)
- 2 extensions from [`.pi/extensions/`](.pi/extensions/) (session hook + shortcuts + pipeline commands)
- Consolidated role definitions from [`.pi/prompts/shared-agents.md`](.pi/prompts/shared-agents.md)
- Cadence workflow rules from [`.pi/prompts/cadence.md`](.pi/prompts/cadence.md)

### Prerequisites

- [Pi coding agent](https://shittycodingagent.ai) (`@mariozechner/pi-coding-agent`)
- Node 18+ (config parser is shipped with each skill)
- [Obsidian](https://obsidian.md) with the two community plugins below:
  - **Kanban** by *mgmeyers* — renders `Sprint/Board.md` and `Product-Backlog.md` as drag-and-drop boards
  - **Tasks** by *Clare Macrae* — interprets the `- [ ] ... 📅 YYYY-MM-DD ⏫` task syntax used inside stories and boards
- Git + [GitHub CLI](https://cli.github.com) (`gh`) — used by `/done` for PR creation

### Vault location

The vault path is **not hardcoded in Pi skills**. All Pi prompts and skills use a `<Obsidian_Vaults>` placeholder that is resolved per-project from the `## Obsidian Project` block in `AGENTS.md`. You can keep your vault anywhere — `C:\Obsidian_Vaults`, `~/Obsidian_Vaults`, an iCloud folder, a synced drive, anywhere Pi can read and write.

Convention: point all three fields at the same root.

```markdown
## Obsidian Project
- Vault project: <ProjectName>
- Sprint Board: D:/work/vault/<ProjectName>/Sprint/Board.md
- Product Backlog: D:/work/vault/<ProjectName>/Backlog/Product-Backlog.md
- Specs: D:/work/vault/<ProjectName>/Specs/
- Research: D:/work/vault/<ProjectName>/Research/
```

After install, create an `AGENTS.md` at the root of any project you want cadence to manage, with at minimum:

```markdown
## Obsidian Project
- Vault project: <ProjectName>
- Sprint Board: <path>/<ProjectName>/Sprint/Board.md
- Product Backlog: <path>/<ProjectName>/Backlog/Product-Backlog.md
```

Without `AGENTS.md`, the skills know the workflow but won't touch any vault files (safe default).

---

## Commands

### Full skill names

All 12 skills, invoked as `/skill:cadence-<name>`:

| Skill | When to use |
|-------|-------------|
| `/skill:cadence-init <project>` | Initialize a new project vault structure |
| `/skill:cadence-board` | Show sprint board + backlog (read-only) |
| `/skill:cadence-interview <desc>` | Socratic interview before story creation |
| `/skill:cadence-story <desc>` | Create a user story with ontology gate |
| `/skill:cadence-sprint` | Start, archive, or retro a sprint |
| `/skill:cadence-pickup [story]` | Pick up a story (creates a branch) |
| `/skill:cadence-done` | Complete story — push, PR, review |
| `/skill:cadence-review` | 4-stage automated review cycle |
| `/skill:cadence-learn` | Extract learnings into the vault |
| `/skill:cadence-spike <question>` | Time-boxed research spike |
| `/skill:cadence-sync` | Sync existing vault project to conventions |
| `/skill:cadence-release` | Cut a release — version, changelog, tag, GitHub Release |

### Shortcut commands

The [cadence-flow extension](.pi/extensions/cadence-flow.ts) registers 6 shortcuts that alias common skills:

| Shortcut | Same as |
|----------|---------|
| `/board` | `/skill:cadence-board` |
| `/pickup <story>` | `/skill:cadence-pickup <story>` |
| `/done` | `/skill:cadence-done` |
| `/review` | `/skill:cadence-review` |
| `/learn` | `/skill:cadence-learn` |
| `/interview <desc>` | `/skill:cadence-interview <desc>` |

---

## How roles work (Pi's model of subagents)

Pi does **not** have a Task/subagent runtime the way Claude Code does. When a skill on Pi "invokes" a shared agent, it does so by **role-playing the agent's prompt inline**. The role definitions live in [`.pi/prompts/shared-agents.md`](.pi/prompts/shared-agents.md) — one consolidated file with 20 roles, auto-generated from `shared/agents/*.md`.

Practically this means:

- Each review stage in `/skill:cadence-review` runs roles **sequentially**, not in parallel (Claude runs Stage 3 in parallel across subagents)
- The same conventions and output shapes apply — a `semantic-evaluator` on Pi returns the same structured block a `semantic-evaluator` subagent on Claude returns
- Context-isolation is not automatic — the skill prompts the model with just the inputs each role needs

The 20 roles are the same as the Claude package. See the [repo-root README](../../README.md#shared-agents-20) for the full list.

---

## Review pipeline

Same 4-stage structure as the Claude package:

```
Stage 1: Mechanical        (build + lint + tests + coverage)
Stage 2: Semantic          (semantic-evaluator → ontologist post-impl)
Stage 3: Domain review     (code-reviewer, security-reviewer, qa-judge, language reviewers,
                            domain reviewers, + optional pattern-auditor, integration-validator,
                            contrarian, design-auditor)
Stage 4: Consensus         (conditional — advocate → judge → consensus-reviewer)
Aggregate: evaluator       (findings ledger, verdict)
```

Verdicts: `PASS` (Hard Gates) · `FIX_REQUIRED` (Structured Repair R1/R2/R3) · `BLOCK`.

**Stage 4 triggers** (any one fires): `--consensus` flag · ≥2 regressions · contested findings · high-stakes story (CONSTRAINTS contain "mainnet" / "production" / "payments" / "auth" / "keypair" / "signing" / "funds") · any CRITICAL Stage-3 finding.

**`design-auditor` routing** (the "don't assume code is wrong" agent):
- `UPDATE_CODE` → falls into Structured Repair as usual
- `UPDATE_DESIGN` → Pi offers to edit `design.md`; user can veto
- `ASK_USER` → cycle pauses; user answers `code` / `design` / `skip` — Pi never picks a side on its own

---

## Extensions

### cadence-flow.ts (session hook + shortcuts + worktree management)

[`cadence-flow.ts`](.pi/extensions/cadence-flow.ts) replaces Claude Code's hooks with Pi's extension API:

- **session_shutdown** — reads `AGENTS.md`, finds the Sprint Board path, scans for items under `## In Progress`, warns if any remain so you don't forget mid-story work
- **Worktree management** — `/worktree create|list|remove|exit|status` for git worktree isolation per story
- **Bash interception** — when a worktree is active, transparently routes all bash commands to the worktree directory
- **Shortcut commands** — the six `/board`, `/pickup`, `/done`, `/review`, `/learn`, `/interview` aliases (see table above)

### cadence-pipeline.ts (autonomous story execution)

[`cadence-pipeline.ts`](.pi/extensions/cadence-pipeline.ts) registers `/pipeline` commands for autonomous multi-story execution:

| Command | Description |
|---------|------------|
| `/pipeline start <stories...\|epic> [--mode single\|parallel]` | Start autonomous pipeline execution |
| `/pipeline status [pipeline-id]` | Show pipeline progress |
| `/pipeline abort [pipeline-id]` | Abort a running pipeline |

The pipeline extension wires together the modules in `shared/pipeline/`:

| Module | Purpose |
|--------|---------|
| `pipeline-state.mjs` | Create, read, update pipeline state files in `<vault>/Pipeline/` |
| `cadence-pipeline-commands.mjs` | Argument parsing, story resolution, status formatting |
| `worker-spawn.mjs` | Spawn Pi subprocess workers using `--mode json -p` |
| `sequential-executor.mjs` | Single-agent mode — stories run one at a time in dependency order |
| `parallel-executor.mjs` | Multi-agent mode — bounded concurrency with dynamic dependency scheduling |
| `pipeline-visibility.mjs` | Progress display, completion summaries, log files |
| `pipeline-resilience.mjs` | Transient error detection, model fallback chains, human escalation |

**Pipeline modes:**
- **`single`** (sequential) — one Pi worker at a time. Stories execute in topological order respecting `Depends-On` declarations. If a story fails, all dependent stories are marked `blocked` (exit code -1). Independent stories after the failure still run.
- **`parallel`** — up to `maxConcurrency` workers (default 3) run simultaneously. Dependency-aware: a story only starts when all its declared dependencies are `done`. Failed stories cause dependents to be skipped. PR merges are serialized via a FIFO queue to prevent git conflicts.

**How it works:**
1. `/pipeline start` resolves story names from the vault (or extracts them from an epic file via `[[STORY-xxx]]` wiki links)
2. Skips stories already "In Progress" on the sprint board (manual work priority guard)
3. Creates a pipeline state file at `<vault>/Pipeline/PIPELINE-<id>.md`
4. Spawns Pi workers using `--mode json -p` — each worker gets a fresh subprocess with its own context window (no context pollution between stories)
5. Workers run the full cadence lifecycle: TDD (RED → GREEN → IMPROVE) → commit → push → PR
6. The orchestrator tracks state, handles failures, and updates the pipeline state file

**Resilience features:**
- Transient error detection (rate limits, timeouts, 5xx errors) with automatic model fallback chains
- Consecutive failure pause (default: 2 failures → pause and escalate to user)
- Human-in-the-loop escalation with structured findings and options
- Recursion guard: workers set `PI_SUBAGENT_MAX_DEPTH=1` to prevent sub-agent spawning

**Configuration** (in `## Cadence Config` in `AGENTS.md`):

```yaml
pipeline.worker_model: deepseek/deepseek-r1        # Model for worker subprocesses
pipeline.worker_thinking: high                       # Thinking level for workers
pipeline.fallback_models: huggingface/qwen-2.5-coder # Comma-separated fallback chain
pipeline.max_concurrency: 3                          # Parallel mode: max simultaneous workers
```

---

## Cadence Config (per-project overrides)

Add a `## Cadence Config` block to your `AGENTS.md`:

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

All 12 skills load this on startup via the colocated `parse-cadence-config.mjs`. Path resolution uses Pi's `{baseDir}` placeholder — substituted at invocation time to the skill's own directory, regardless of the user's cwd.

Full key list, defaults, and safety-critical non-configurable gates are documented in `shared/core.md`.

---

## Differences from the Claude Code package

| Aspect | Claude Code | Pi |
|--------|-------------|-----|
| Subagents | Real `Task`-based subagent runtime — parallel execution | Inline role-play — sequential execution |
| Branch isolation | `EnterWorktree` (non-negotiable) | Plain `git checkout -b feature/STORY-*` |
| Config parser path | `${CLAUDE_SKILL_DIR}/parse-cadence-config.mjs` (env var) | `{baseDir}/parse-cadence-config.mjs` (text placeholder) |
| Session-end hook | `Stop` hook → `check-board.js` | Extension `session_shutdown` event |
| Shortcut commands | None (use full `/cadence:*` names) | 6 shortcuts via extension |
| Pipeline execution | Not available | `/pipeline start` with sequential or parallel mode |
| Context file | `CLAUDE.md` | `AGENTS.md` |

Aside from the above, everything else is the same — same 20 roles, same review pipeline, same story format, same ontology gate, same Cadence Config knobs.

---

## Troubleshooting

### `/skill:cadence-story` errors with "Parser not found"

You're running an older install. The current version ships `parse-cadence-config.mjs` inside every skill directory and resolves via `{baseDir}`. Reinstall with `pi install git:github.com/shoebillrexmail-cmyk/agentic-cadence.git`.

### "No AGENTS.md found" — no board updates happening

Pi skills follow a safe-default policy: without the `## Obsidian Project` block in `AGENTS.md` pointing at the vault, the skills know the workflow but don't touch any files. Run `/skill:cadence-init <project>` to set up the structure and write the `AGENTS.md` stub.

### The session_shutdown warning fires every time

That's the board warning — if you have items in "In Progress", Pi reminds you at exit. If the items are stale, move them to Done / back to Ready via `/skill:cadence-board` or edit the Kanban file directly.

### A shortcut command isn't registering

Shortcuts are registered by [`cadence-flow.ts`](.pi/extensions/cadence-flow.ts). Confirm the extension is loaded: `pi extensions list`. Reinstalling the package re-registers them.

### `/pipeline` commands not recognized

Pipeline commands are registered by [`cadence-pipeline.ts`](.pi/extensions/cadence-pipeline.ts). It coexists with `cadence-flow.ts` — no conflicts. If `/pipeline` doesn't appear, check that both extensions are loaded. The pipeline modules in `shared/pipeline/` must be present in the project (they are not bundled with the extension).

---

## Development

```bash
npm run build:pi          # Rebuild the Pi package from shared/
npm test                  # Config parser tests (26 cases)
```

Hand-edit targets:
- `packages/pi/.pi/skills/<name>/SKILL.md` — the skill logic
- `packages/pi/.pi/extensions/cadence-flow.ts` — session hooks + shortcut commands + worktree management
- `packages/pi/.pi/extensions/cadence-pipeline.ts` — pipeline commands (`/pipeline start|status|abort`)
- `shared/pipeline/*.mjs` — pipeline execution modules (state, workers, executors, resilience)
- `packages/pi/build/*.md` — Pi-specific fragments merged into generated prompts
- `shared/agents/<name>.md` — role definitions (regenerated into the consolidated `shared-agents.md`)

**Do NOT hand-edit** `.pi/prompts/shared-agents.md` or `.pi/prompts/cadence.md` — both are generated. Author in `shared/` and run `npm run build:pi`.

See the [repo-root README](../../README.md) for monorepo-level conventions.
