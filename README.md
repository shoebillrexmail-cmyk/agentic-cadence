# Agentic Cadence

Agent workflow framework for AI coding agents. Socratic interviews clarify requirements before work starts. Specialist guilds provide domain expertise. Structured stories with ontology gates prevent solving the wrong problem. TDD enforcement, a 4-stage automated review cycle, and a learning knowledge base close the loop.

**Works with [Claude Code](packages/claude/README.md) and [Pi](packages/pi/README.md). Domain plugins for any stack.**

---

## What it gives you

- **Socratic interviews** — clarify vague requirements through structured questioning (Ontologist, Breadth Keeper, Simplifier, Socratic Interviewer, Seed Closer) before creating stories
- **Ontology gate** — 4 fundamental questions (Essence / Root Cause / Prerequisites / Hidden Assumptions) block stories that treat symptoms
- **Structured stories** with GOAL, CONSTRAINTS, NON_GOALS, EVALUATION_PRINCIPLES, EXIT_CONDITIONS, and ONTOLOGY — machine-verifiable spec fields produced by the `seed-architect` agent
- **Kanban boards** in Obsidian for sprint and backlog management
- **Git branch isolation** — one branch per story; Claude Code uses worktrees for parallel sessions
- **TDD enforcement** — tests-first workflow with 80%+ coverage target
- **4-stage automated review** — mechanical → semantic → domain → consensus, with fix/re-review loop (max 3 cycles by default)
- **Design-doc consistency** — a `design-auditor` agent flags drift between `design.md` and implementation, asking the user before assuming code is wrong
- **Hard quality gates** — tests must pass, no CRITICAL findings, coverage warned
- **Learning system** — builds educational knowledge base from completed stories, cross-project where applicable
- **Domain plugins** — OPNet Bitcoin L1 plugin included (17 agents, 11 knowledge slices, 27 real-bug patterns, TLA+ verification)

---

## Which runtime?

Agentic Cadence runs in two different coding agents. Pick one and follow its README:

| Runtime | Install via | Commands | Deep-dive README |
|---------|------------|----------|------------------|
| **Claude Code** | `bash packages/claude/install.sh` + plugin install | `/cadence:<name>` | [packages/claude/README.md](packages/claude/README.md) |
| **Pi** | `pi install git:github.com/shoebillrexmail-cmyk/agentic-cadence.git` | `/skill:cadence-<name>` + shortcuts + `/pipeline` | [packages/pi/README.md](packages/pi/README.md) |

Both runtimes implement the same conventions (defined in `shared/core.md`). Differences live in the per-package READMEs.

---

## Monorepo layout

```
agentic-cadence/
├── shared/                              # Single source of truth
│   ├── core.md                          # Conventions (vault, boards, stories, review, git, learning)
│   ├── specialist-convention.md         # Domain plugin integration spec
│   ├── build.mjs                        # Regenerates packages from shared core
│   ├── scripts/parse-cadence-config.mjs # Canonical config parser (copied into each skill on build)
│   ├── agents/                          # 20 shared agent definitions (canonical)
│   ├── pipeline/                        # Pipeline execution modules (state, workers, executors, resilience)
│   └── templates/vault/                 # 13 Obsidian templates
│
├── packages/
│   ├── claude/                          # Claude Code plugin ── see packages/claude/README.md
│   ├── pi/                              # Pi package          ── see packages/pi/README.md
│   └── domain/
│       └── opnet/                       # OPNet Bitcoin L1 domain plugin
│
└── package.json                         # npm run build / test
```

### How build works

1. Edit `shared/core.md` or `shared/agents/<name>.md` — single source of truth.
2. Run `npm run build` — assembles per-runtime outputs:
   - Claude agents at `packages/claude/agents/` (wrapped with frontmatter)
   - Pi consolidated role reference at `packages/pi/.pi/prompts/shared-agents.md`
   - `parse-cadence-config.mjs` copied into every skill that uses it (resolves path via `${CLAUDE_SKILL_DIR}` on Claude, `{baseDir}` on Pi)
3. `npm run build:claude` / `build:pi` / `build:domain` run a single target.

### Shared agents (20)

All live in `shared/agents/` and get emitted into both runtimes on build. Short summary:

| Agent | Role |
|-------|------|
| `ontologist` | Root-cause gate — 4 fundamental questions |
| `socratic-interviewer` | One focused question per round |
| `breadth-keeper` | Tracks multi-topic interviews to avoid topic collapse |
| `simplifier` | Challenges scope; proposes cuts |
| `seed-closer` | 7-criterion interview-closure check |
| `seed-architect` | Produces GOAL / CONSTRAINTS / NON_GOALS / EVALUATION / EXIT / ONTOLOGY block |
| `ontology-analyst` | Domain model with entities, relations, state transitions, invariants |
| `contrarian` | Inverts story assumptions; stress-tests design before and after code |
| `researcher` | Prior-art / library investigation with citations |
| `semantic-evaluator` | Measures implementation drift from structured spec (intent vs code) |
| `qa-judge` | Judges each acceptance criterion; test-coverage evidence |
| `pattern-auditor` | Applies domain bug catalogs to changed files |
| `integration-validator` | ABI / API / schema consistency across layers |
| `design-auditor` | Compares `design.md` to code; `UPDATE_CODE` / `UPDATE_DESIGN` / `ASK_USER` per row |
| `advocate` | Steel-mans the implementation against reviewer findings |
| `judge` | Arbitrates advocate vs reviewers — binding rulings |
| `consensus-reviewer` | Final ledger assembly |
| `evaluator` | Pure aggregator of all stage outputs → verdict |
| `hacker` | Invoked when the fix loop is stuck — bypass / reframe options |
| `cadence-pm` | Maintains the Obsidian vault (boards, stories, specs) |

---

## Domain plugins

Domain plugins live in `packages/domain/<name>/` and provide specialist agents, knowledge, and skills for a specific tech stack.

**Included: [OPNet](packages/domain/opnet/)** — Bitcoin L1 smart contract platform
- 17 specialist agents (contract dev, frontend dev, backend dev, 7 reviewers, deployer, migration planner, spec writer, spec auditor, e2e tester)
- 11 knowledge slices + a 2,000-line bible + troubleshooting guide
- 27 real-bug security patterns, TLA+ formal verification tooling, PUA exhaustive problem-solving methodology
- 3 skills: `pua`, `audit-from-bugs`, `verify-spec`

### Adding a domain plugin

1. Create `packages/domain/<name>/` with:
   - `specialists.md` — detection rules, agent routing tables, domain rules, test types
   - `agents/` — domain agent definitions
   - `knowledge/` — bible, slices, troubleshooting
   - `skills/` (optional) — domain-specific skills
   - `agent-routing.md` (optional) — auto-trigger rules for agent invocation
2. Add `package.json` with a `"domain"` field
3. `npm run build:domain` validates structure and counts
4. Reference in `shared/core.md` Domain Plugins table

See `shared/specialist-convention.md` for the full spec.

---

## Story lifecycle

```
Icebox → [Optional: /cadence:interview] → Needs Refinement → Refined → Ready
                                                                          │
Sprint Board:                                                              ▼
  Ready → In Progress → In Review → Done
                          │                │
                   PR → /cadence:review    /pipeline start (Pi only)
                          │                │
                    Hard Gates         Sequential or Parallel
                          │                │
                    /cadence:learn      Autonomous workers
```

### Review pipeline (every story in review goes through this)

| Stage | Runs | Effect |
|-------|------|--------|
| **1. Mechanical** | build + lint + tests + coverage | Fail here → stages 2–4 skipped |
| **2. Semantic** | `semantic-evaluator` + `ontologist` (post-impl gate) | Catches drift from structured spec AND from root-problem framing |
| **3. Domain review** | `code-reviewer`, `security-reviewer`, `qa-judge`, language-specific reviewers, domain agents, optional `pattern-auditor` / `integration-validator` / `contrarian` / `design-auditor` | Each produces findings with severity |
| **4. Consensus** (conditional) | `advocate` → `judge` → `consensus-reviewer` | Runs when: `--consensus` flag, ≥2 regressions, contested findings, high-stakes story, or any CRITICAL Stage-3 finding |
| **Aggregate** | `evaluator` | Consolidates into cross-cycle findings ledger with verdict |

Verdicts: `PASS` (hard gates) · `FIX_REQUIRED` (structured R1/R2/R3 repair + re-review) · `BLOCK` (CRITICAL — manual intervention).

The cycle loops up to `review.max_cycles` (default 3, configurable per project).

---

## Configuration

Each project can override defaults via a `## Cadence Config` block in its `CLAUDE.md` (Claude) or `AGENTS.md` (Pi):

````markdown
## Cadence Config
```yaml
review.max_cycles: 5
review.force_consensus: true
agents.disable: [simplifier]
interview.auto_trigger_on_vague: false
```
````

All cadence skills load this via `parse-cadence-config.mjs` on startup. Full key list in `shared/core.md`. Safety-critical gates (Ontology Gate, Stage 1 mechanical, security reviewer) cannot be disabled.

---

## Contributing / building

```bash
npm install
npm run build              # Build Claude + Pi + validate domains
npm run build:claude
npm run build:pi
npm run build:domain
npm test                   # Config parser tests (26 cases)
```

Prerequisites:
- Node 18+
- Git + GitHub CLI (`gh`) — used by `/cadence:done` for PR creation
- [Obsidian](https://obsidian.md) with the two community plugins below (enable after opening the vault):
  - **Kanban** by *mgmeyers* — renders `Sprint/Board.md` and `Product-Backlog.md` as drag-and-drop boards
  - **Tasks** by *Clare Macrae* — powers the `- [ ] ... 📅 YYYY-MM-DD ⏫` task syntax used inside stories and boards
- One of: [Claude Code](https://code.claude.com) or [Pi](https://shittycodingagent.ai)

### Vault location — is it fixed?

**No, the vault location is configurable.** Nothing in the framework *requires* `C:\Obsidian_Vaults` specifically; it's just the Windows default.

How the path is resolved, in priority order:

1. **Per-project context file** — each project's `CLAUDE.md` (Claude) or `AGENTS.md` (Pi) has an `## Obsidian Project` block with absolute paths to `Sprint/Board.md`, `Backlog/Product-Backlog.md`, etc. Skills read these first.
2. **Installer prompt** — `packages/claude/install.sh` asks for the vault path and rewrites `obsidian-workflow.md` to match. Set `OBSIDIAN_VAULT_PATH` to skip the prompt in scripted installs.
3. **Default** — `C:\Obsidian_Vaults` on Windows, `~/Obsidian_Vaults` elsewhere.

Claude also needs the chosen path added to `permissions.additionalDirectories` in `~/.claude/settings.json` so skills can read/write the vault. Both Claude skills and Pi skills use a `<Obsidian_Vaults>` placeholder internally, resolved at runtime from the installer-rewritten rule file (Claude) or from `AGENTS.md` (Pi).

### Adding a convention

1. Edit `shared/core.md`
2. If a runtime needs agent-specific behavior, add a fragment in `packages/<claude|pi>/build/`
3. `npm run build` to regenerate
4. Verify the generated outputs in `packages/claude/rules/`, `packages/pi/.pi/prompts/`, and any affected `packages/<runtime>/skills/*/SKILL.md`
5. Bump the appropriate runtime's `package.json` / `plugin.json` if publishing

### Adding a shared agent

1. Create `shared/agents/<name>.md` — body is the prompt; first non-empty line becomes the `description` field
2. (Optional) Update the model-tier lists in `shared/build.mjs` (`opusAgents` / `haikuAgents`) — otherwise defaults to Sonnet
3. (Optional) Update the tool allowlist in `toolsFor()` — default is read-only (`Read`, `Glob`, `Grep`)
4. Wire it into the skills that should call it (reference by name from the skill's `## Step N` section)
5. `npm run build` — agent is emitted to `packages/claude/agents/<name>.md` and rolled into `packages/pi/.pi/prompts/shared-agents.md`

---

## License

MIT
