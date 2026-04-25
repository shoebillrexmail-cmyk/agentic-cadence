# Cadence — Obsidian Vault Integration (Pi)

## Vault Location
- Each project has its own folder within the Obsidian vault
- Shared knowledge base at vault root: `_Knowledge/` (cross-project)
- The current project's vault folder is specified in the repo's AGENTS.md under `## Obsidian Project`
- Read and write vault files directly using the `read` and `write` tools

---


# Agentic Cadence — Core Conventions

> This is the **single source of truth** for all Agentic Cadence conventions.
> Both the Claude and Pi packages build their agent-specific rules/prompts from this document.
>
> When editing conventions, edit THIS file — then run `npm run build` to regenerate packages.

---

## Vault Structure

Each project has its own folder within the Obsidian vault, plus a shared cross-project knowledge base:

```
<Obsidian_Vaults>/
├── _Knowledge/                      # Shared cross-project knowledge base
│   ├── Index.md                     # Domain-indexed catalog (severity-badged)
│   ├── Gotchas/
│   │   └── GOTCHA-<name>.md
│   ├── Patterns/
│   │   └── PATTERN-<name>.md
│   ├── Guides/
│   │   └── GUIDE-<name>.md
│   └── Writeups/
│       └── WRITEUP-<name>.md
│
└── <ProjectName>/
    ├── Roadmap.md
    ├── Sprint/
    │   └── Board.md
    ├── Backlog/
    │   ├── Product-Backlog.md
    │   ├── Epics/
    │   │   └── EPIC-<name>.md
    │   └── Stories/
    │       └── STORY-<name>.md
    ├── Specs/
    │   ├── Features/
    │   │   └── SPEC-<feature>.md
    │   ├── Technical/
    │   │   └── SPEC-<component>.md
    │   └── API/
    │       └── SPEC-<endpoint>.md
    ├── Learning/
    │   ├── Index.md
    │   ├── Integrations/
    │   │   └── GUIDE-<tech>.md
    │   ├── Patterns/
    │   │   └── PATTERN-<name>.md
    │   └── Writeups/
    │       └── WRITEUP-<topic>.md
    ├── Research/
    │   └── SPIKE-<topic>.md
    ├── Notes/
    │   ├── Decisions/
    │   ├── Daily/
    │   └── Retros/
    └── Archive/
        ├── Sprint-YYYY-MM-DD.md
        └── Release-vX.Y.Z.md
```

## Project Config

Each code repo links to its vault project via a config section in its project context file:

**Claude**: `CLAUDE.md`
**Pi**: `AGENTS.md`

```markdown
## Obsidian Project
- Vault project: <ProjectName>
- Sprint Board: <path>/<ProjectName>/Sprint/Board.md
- Product Backlog: <path>/<ProjectName>/Backlog/Product-Backlog.md
- Specs: <path>/<ProjectName>/Specs/
- Research: <path>/<ProjectName>/Research/
```

Without this config, the agent knows the workflow but won't touch any vault files (safe default).

## Agile Hierarchy

```
Roadmap (phases)
  └── Epic (large body of work)
        └── Story (user-facing value, has acceptance criteria)
              ├── Tasks (checklist items within the story)
              ├── Specs (linked detailed documents in Specs/)
              └── Branch: feature/STORY-<name> (via git worktree)
```

---

## Board Formats

### Product Backlog (`Backlog/Product-Backlog.md`)

```markdown
---
kanban-plugin: basic
---

## Icebox
%% Ideas and low-priority items — not yet evaluated %%

## Needs Refinement
%% Accepted ideas that need research, story writing, or breakdown %%

## Refined
%% Fully defined stories with acceptance criteria — ready to pull into a sprint %%
```

### Sprint Board (`Sprint/Board.md`)

```markdown
---
kanban-plugin: basic
---

## Ready
%% Refined stories/tasks pulled from Backlog into this sprint %%

## In Progress
%% Actively being worked on — limit WIP to 2-3 items %%

## In Review
%% Code complete, awaiting review or verification %%

## Done
%% Accepted and complete %%
```

## Story Format

Stories in `Backlog/Stories/STORY-<name>.md`:

```markdown
# Story: <Name>

**Epic**: [[EPIC-name]]
**Branch**: `feature/STORY-<name>`
**Points**: 1 | 2 | 3 | 5 | 8 | 13
**Priority**: ⏫ High | 🔼 Medium | 🔽 Low
**Status**: Icebox | Needs Refinement | Refined | Ready | In Progress | In Review | Done
**PR**: (link when created)

## User Story
As a **[role]**, I want **[capability]**, so that **[benefit]**.

## Specs
- [[Specs/Features/SPEC-feature-name]]

## Specialist Context
**Project type**: [detected type(s)]
**Domain**: [matched domain plugin, if any]
**Specialists consulted**: [list]
**Key recommendations**: [...]
**Specialist agents for development**: [...]
**Domain rules**: [...]
**Known pitfalls**: [...]

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]

## Testing Strategy
**Test framework**: [detected or recommended]
**Coverage target**: 80%+
**TDD required**: Yes — write tests FIRST, then implement

### Unit Tests
- [ ] [concrete test requirement]

### Integration Tests
- [ ] [concrete test requirement]

### [Domain-specific tests, if applicable]

### E2E Tests (if applicable)
- [ ] [concrete test requirement]

## Tasks
- [ ] Set up test infrastructure (if not already present)
- [ ] Write unit tests (RED phase — tests should fail)
- [ ] Implement [component/feature]
- [ ] Write integration tests
- [ ] Verify all tests pass (GREEN phase)
- [ ] Refactor (IMPROVE phase)
- [ ] Verify coverage >= 80%

## Notes
[Specialist feedback, architectural decisions, constraints]
```

## Story Interview Protocol

Before writing a story, an optional Socratic interview can clarify vague requirements into actionable specifications. This prevents the #1 cause of wasted work: building the wrong thing.

### When to Interview

| Signal | Interview? |
|--------|------------|
| User describes a feature in 1-2 sentences | YES — almost certainly vague |
| User provides detailed spec with clear boundaries | SKIP — already clear |
| User says "fix X" or "add Y" without context | YES — root cause likely unclear |
| User explicitly requests interview | YES — they know it's vague |
| Story is a small bugfix with clear reproduction | SKIP — scope is obvious |
| Multiple features mentioned at once | YES — breadth risk |

### Interview Flow

```
User describes feature
  │
  ▼
┌─────────────────────────────────┐
│  Round 1: Scope & Essence       │
│  - "What IS this, really?"      │
│  - "What's the core problem?"   │
│  - List all ambiguity tracks    │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Rounds 2-4: Deepen & Challenge │
│  - Root cause vs symptom check  │
│  - Non-goals clarification      │
│  - Hidden assumptions surfacing │
│  - Breadth check: other tracks? │
│  - Simplicity challenge         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Round 5: Closure Check         │
│  - Scope, non-goals, outputs,   │
│    verification all explicit?   │
│  - Any material blocker left?   │
│  - Ready for story creation?    │
└──────────────┬──────────────────┘
               │
               ▼
        Story Creation (enhanced)
```

### Interview Roles

Each round combines perspectives from four roles. The agent conducting the interview cycles through them based on what's most needed:

| Role | Purpose | Key Questions |
|------|---------|--------------|
| **Socratic Interviewer** | Reduce ambiguity through targeted questions | "What happens when X?", "How should this handle Y?" |
| **Ontologist** | Find the root problem, not symptoms | "What IS this?", "Root cause or symptom?", "What are we assuming?" |
| **Breadth Keeper** | Prevent collapse onto one sub-topic | "What about the other requirement you mentioned?", "Are there more tracks?" |
| **Simplifier** | Challenge scope creep | "What's the simplest version that works?", "Can we cut half the features?" |

### Interview Output

The interview produces a structured clarification captured in the story's `## Interview Notes` section:

```markdown
## Interview Notes

### Clarified Scope
[What we're building, in specific terms]

### Root Problem (vs Symptom)
[The actual problem this solves — confirmed not a symptom]

### Non-Goals
[Explicitly out of scope]

### Hidden Assumptions
[Assumptions that were surfaced and either confirmed or rejected]

### Simplification
[What was cut or simplified from the original ask]

### Verification Expectations
[How the user will judge success]
```

### Breadth Tracking

When the user's initial description contains multiple features, concerns, or deliverables:
1. List all identified tracks at the start
2. After every 2 rounds on one track, check: "Any other tracks still need clarification?"
3. Never let one track dominate more than 3 consecutive rounds without a breadth check
4. Close the interview only when ALL tracks are resolved or explicitly deferred

## Ontology Gate (Story Quality Check)

Before finalizing ANY story, run these 4 fundamental questions as a mandatory quality gate:

### The Four Questions

| # | Question | Purpose | Pass Criteria |
|---|----------|---------|---------------|
| 1 | **Essence**: "What IS this, really?" | Strip away surface details to find the true nature | Story describes the core problem, not surface symptoms |
| 2 | **Root Cause**: "Is this the root cause or a symptom?" | Ensure we're solving the fundamental issue | The story addresses the actual root cause, or explains why treating the symptom is the right call |
| 3 | **Prerequisites**: "What must exist first?" | Surface hidden dependencies | All prerequisites are either already present or captured as separate stories/tasks |
| 4 | **Hidden Assumptions**: "What are we assuming?" | Surface implicit beliefs | Key assumptions are documented in the story or confirmed as valid |

### Gate Outcomes

| Result | Action |
|--------|--------|
| **All 4 pass** | Story is well-formed — proceed to creation |
| **Root cause = symptom** | Split the story: one for root cause, one (optional) for surface fix. User chooses priority. |
| **Missing prerequisites** | Add prerequisite stories to backlog first, mark this story as blocked |
| **Wrong assumptions** | Rewrite the story with corrected assumptions before proceeding |

### Integration Point

The Ontology Gate runs automatically during `cadence-story` creation (Step 7 of the skill), AFTER specialist consultation but BEFORE writing the story file. It's also available as a standalone quality check via `cadence-interview --gate-only`.

---

## Task Format (on boards)

```markdown
- [ ] [[STORY-name]]: Task description ⏫ 📅 YYYY-MM-DD
```

- ⏫ = high, 🔼 = medium, 🔽 = low priority
- Completed: `- [x] [[STORY-name]]: Task description ✅ YYYY-MM-DD`

## Spec Linking

Stories should NOT contain full specifications. Instead:
- Write detailed specs in `Specs/Features/` or `Specs/Technical/`
- Link from the story using `[[Specs/Features/SPEC-name]]`
- API contracts go in `Specs/API/`

---

## Story Lifecycle

```
┌──────────┐    ┌───────────────────────────────────────────┐
│  Icebox  │ →  │  [OPTIONAL] Interview Phase               │
│          │    │  Socratic questioning → Ontology Gate      │
└──────────┘    │  Root cause check → Simplification check   │
                └───────────────┬───────────────────────────┘
                                │
                                ▼
                ┌──────────┐    ┌─────────────┐    ┌───────────┐    ┌──────┐
                │  Needs   │ →  │  Refined    │ →  │  Ready    │ →  │  In  │
                │Refinement│    │(sprint-ready)│    │(on board) │    │Progr.│
                └──────────┘    └─────────────┘    └───────────┘    └──┬───┘
                                                                       │
                 Load specialists + prior learnings + TDD brief        │
                 Enter isolated worktree → TDD: RED → GREEN → IMPROVE   │
                                                                       │
                    ┌──────────────────────────────────────────────────┘
                    │  Complete story
                    ▼
          ┌─────────────────┐
          │   Doc Gate      │  Update README, CHANGELOG, API docs
          │   + PR Creation │  Create user-facing docs backlog task
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Review Cycle   │  Parallel agents → findings → R1/R2/R3 repair
          │  (max 3 cycles) │  Incremental re-review → regression detection
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Hard Gates     │  Tests pass? No CRITICAL findings? Coverage?
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  Learn          │  Classify → _Knowledge/ (cross-cutting)
          │                 │          or Learning/ (project-specific)
          └────────┬────────┘
                   │
                   ▼
             ┌──────────┐
             │   Done   │
             └──────────┘
```

### Story Stages

| Stage | Board Column | Description |
|-------|-------------|-------------|
| Icebox | (not on board) | Raw idea, not yet evaluated |
| Needs Refinement | Backlog: Needs Refinement | Accepted, needs story writing |
| Refined | Backlog: Refined | Full story with acceptance criteria |
| Ready | Sprint: Ready | Pulled into sprint, ready to pick up |
| In Progress | Sprint: In Progress | Actively being worked on |
| In Review | Sprint: In Review | PR created, review cycle running |
| Done | Sprint: Done | Accepted, learnings extracted |

---

## TDD Enforcement

TDD is mandatory for all story implementation:

1. **RED** — Write tests FIRST. Tests must fail (confirms they test the right thing).
2. **GREEN** — Implement minimum code to make tests pass.
3. **IMPROVE** — Refactor for clarity, DRY, maintainability. Coverage must be >= 80%.

Test commits come first: `test(scope): add tests for [component]`
Implementation commits: `feat(scope): implement [component]`

---

## Review Cycle

When a story moves to "In Review":

1. **Detect** what changed (files, project type, domain)
2. **Select** review agents based on context:

| Always | Language-Specific | Domain-Specific |
|--------|------------------|-----------------|
| `code-reviewer` | `go-reviewer` | From domain plugin |
| `security-reviewer` | `python-reviewer` | |

3. **Launch** agents in parallel
4. **Collect** findings into a ledger with IDs (`F-001`, `F-002`...) tracking status across cycles
5. **Fix** blocking findings using Structured Repair:
   - **R1 LOCALIZE** — identify exact file, function, line, root cause
   - **R2 PATCH** — generate fix (up to 3 candidates)
   - **R3 VALIDATE** — run tests against fix
6. **Re-review** incrementally (cycle 2+ only re-runs agents that had findings)
7. **Regressions** — fixed then reappeared → auto-elevated to CRITICAL
8. **Repeat** up to 3 cycles
9. **Hard gates**: tests must pass, no CRITICAL security findings

### Findings Ledger

| ID | Cycle Found | Cycle Resolved | Status | Severity | Finding | Agent |
|----|-------------|----------------|--------|----------|---------|-------|
| F-001 | 1 | - | OPEN | CRITICAL | ... | code-reviewer |
| F-002 | 1 | 2 | RESOLVED | HIGH | ... | security-reviewer |

Status: `OPEN` → `RESOLVED` → `REGRESSION` (if reappears)

---

## Hard Gates

Before a story can move to Done:

| Gate | Severity | Description |
|------|----------|-------------|
| Tests pass | BLOCK | Full test suite must pass |
| No CRITICAL security findings | BLOCK | Any CRITICAL security finding blocks |
| Coverage >= 80% | WARN | Below target, reported but not blocking |
| Domain-specific tests exist | WARN | If domain plugin defines test types |

---

## Learning System

Two-tier knowledge architecture:

### Shared Knowledge Base (`_Knowledge/`)

Cross-project knowledge. Any project using this technology would benefit.

```
_Knowledge/
├── Index.md
├── Gotchas/GOTCHA-<name>.md      # "Don't do X because Y"
├── Patterns/PATTERN-<name>.md    # Reusable anti-patterns / best practices
├── Guides/GUIDE-<name>.md        # Technology integration guides
└── Writeups/WRITEUP-<name>.md    # Deep-dive educational content
```

### Project-Specific Learning (`Learning/`)

Only relevant to this project's architecture decisions.

```
Learning/
├── Index.md
├── Integrations/GUIDE-<name>.md
├── Patterns/PATTERN-<name>.md
└── Writeups/WRITEUP-<name>.md
```

### Routing Rule

| Cross-cutting (`_Knowledge/`) | Project-specific (`Learning/`) |
|------------------------------|-------------------------------|
| Any project using this tech would benefit | Only relevant to this project |
| Tied to a technology, language, or framework | Tied to this project's design decisions |
| "Never pass signer on OPNet frontend" | "Our auth middleware uses X pattern" |

**Rule of thumb**: If you have to name the project to explain why it matters, it's project-specific.

### Entry Types

| Type | Prefix | When Created | Destination |
|------|--------|-------------|-------------|
| Gotcha | `GOTCHA-` | Concrete mistake with specific fix | Almost always `_Knowledge/` |
| Pattern | `PATTERN-` | Bug or anti-pattern discovered | `_Knowledge/` or `Learning/` |
| Guide | `GUIDE-` | New technology/service first used | `_Knowledge/` or `Learning/` |
| Writeup | `WRITEUP-` | Complex problem, non-obvious solution | `_Knowledge/` or `Learning/` |

### Mandatory Frontmatter

Every learning entry MUST have:

```yaml
---
type: gotcha | pattern | guide | writeup
domain: [<domains>]
severity: critical | high | medium | low
source_project: <project-name>
source_story: STORY-<name>
date_created: YYYY-MM-DD
last_verified: YYYY-MM-DD
status: active | deprecated | superseded
superseded_by: (link if replaced)
---
```

### Staleness Tracking

- Entries with `last_verified` > 90 days are flagged during story pickup
- Updated when a learning is re-confirmed
- `status: deprecated` entries excluded from pickup

### Deduplication

Before creating a new learning:
1. Check `_Knowledge/` for similar entries → update instead of duplicate
2. Check project `Learning/` for similar entries → update instead of duplicate
3. If genuinely new → create in appropriate location

### Promotion

If a project-specific learning is encountered in a second project → promote to `_Knowledge/`.

---

## Shared Agents

Cadence ships a set of **shared agents** — methodology roles that apply to every project regardless of domain. They live in `shared/agents/` as runtime-agnostic prompt bodies; `shared/build.mjs` wraps each with Claude subagent frontmatter (→ `packages/claude/agents/`) and consolidates the same bodies into a Pi reference file (→ `packages/pi/.pi/prompts/shared-agents.md`) since Pi has no subagent runtime.

Unlike domain agents, shared agents are **always on** — skills invoke them unconditionally. Projects do not opt in via `CLAUDE.md` or `AGENTS.md`; the wiring lives in the skill files themselves.

### Shared agent roster

| Category | Agents | Invoked by |
|----------|--------|-----------|
| Interview | `socratic-interviewer`, `ontologist`, `breadth-keeper`, `simplifier`, `seed-closer` | `cadence-interview`, `cadence-story` Ontology Gate |
| Design | `seed-architect`, `ontology-analyst`, `contrarian` | `cadence-story` Step 5 (Structured Spec) |
| Evaluation | `evaluator`, `semantic-evaluator`, `qa-judge`, `advocate`, `judge`, `consensus-reviewer` | `cadence-review` 4-stage pipeline |
| Methodology | `pattern-auditor`, `integration-validator`, `researcher` | `cadence-review` (augmentation), `cadence-spike` |
| Stuck-recovery | `hacker` | `cadence-pickup` (3+ failures), `cadence-review` (regression loops) |
| Project management | `cadence-pm` | Standalone — a write-enabled agent that skills MAY delegate to when they want vault operations executed in an isolated context with the Kanban / story-template enforcement the agent encodes. Skills currently write vault files directly; `cadence-pm` is provided for skills that want delegated vault writes or for user-triggered cleanup passes (e.g., `/cadence:sync`). |

### Shared vs. domain: when to add which

| You are adding… | Put it in… |
|-----------------|-----------|
| A methodology role that applies regardless of stack (reviewer, interviewer, evaluator) | `shared/agents/` |
| A specialist tied to a specific tech stack (OPNet contract-dev, TLA+ spec-writer, Django security-reviewer) | `packages/domain/<name>/agents/` |
| A role that replaces a shared agent for one stack | **Don't** — domain agents ADD on top of shared; never shadow them |

Domains never need to re-declare shared agents. The `specialists.md` contract only lists what a domain adds over the always-on shared baseline.

---

## Cadence Config (per-project overrides)

Projects can tune cadence skill defaults via an optional `## Cadence Config` block in the project's context file (`CLAUDE.md` for Claude, `AGENTS.md` for Pi). Absence of the block means "use all defaults." Malformed entries become warnings — they never block skill execution.

### Format

```markdown
## Cadence Config
interview.max_rounds: 3
review.force_consensus: true
review.max_cycles: 5
agents.disable: [contrarian, simplifier]
# comments allowed
```

Parser: `shared/scripts/parse-cadence-config.mjs` — canonical source lives here; the build script (`shared/build.mjs`) copies it into each skill directory that needs it. Skills then invoke the local copy so the path resolves regardless of the user's cwd:
- **Claude Code**: `node "${CLAUDE_SKILL_DIR}/parse-cadence-config.mjs" <path-to-context-file>` — `${CLAUDE_SKILL_DIR}` is an env var exposed by Claude Code.
- **Pi**: `node {baseDir}/parse-cadence-config.mjs <path-to-context-file>` — `{baseDir}` is a text placeholder Pi substitutes to the skill's directory at invocation time.

### Supported keys

| Key | Type | Default | Applied by | Effect |
|-----|------|---------|-----------|--------|
| `interview.max_rounds` | int | 5 | `cadence-interview` | Hard cap on interview rounds |
| `interview.auto_trigger_on_vague` | bool | true | `cadence-story` | If false, don't auto-trigger interview on vague requests |
| `review.force_consensus` | bool | false | `cadence-review` | If true, Stage 4 runs every cycle regardless of other triggers |
| `review.max_cycles` | int | 3 | `cadence-review` | Max review/fix iterations |
| `story.skip_interview_for_clear_requests` | bool | true | `cadence-story` | If false, always run interview even for clear specs |
| `story.require_structured_spec` | bool | true | `cadence-story` | If false, `seed-architect` becomes optional |
| `agents.disable` | string[] | [] | All skills | Task invocations of listed agents are skipped with a warn log |
| `pickup.stuck_threshold` | int | 3 | `cadence-pickup` | Failures before `hacker` is invoked |

### NOT configurable (safety-critical)

These are intentionally non-configurable:
- Ontology Gate in `cadence-story` Step 8 — always runs
- Stage 1 mechanical checks in `cadence-review` — always run
- Security reviewer invocation in `cadence-review` Stage 3 — always runs
- Worktree rule (see ## Git Worktrees) — always enforced. Every story MUST use a worktree; zero exceptions.

Only methodology tuning is overridable. Safety gates stay at the baseline.

### Skill invocation pattern

Every cadence skill (`cadence-interview`, `cadence-story`, `cadence-review`, `cadence-pickup`) includes a **Step 0: Load Cadence Config** that:

1. Locates the project context file (`CLAUDE.md` / `AGENTS.md`) — same source as `## Obsidian Project`
2. Runs the parser via Bash — `node "${CLAUDE_SKILL_DIR}/parse-cadence-config.mjs" <path>` on Claude Code or `node {baseDir}/parse-cadence-config.mjs <path>` on Pi
3. Parses the JSON: `{ config, warnings, effective }`
4. Logs any warnings to the user: `Cadence config warnings: …`
5. If `config` is non-empty, logs: `Cadence config applied: { …user-supplied keys… }`
6. Uses `effective` for downstream decisions — skip Task invocations for agents in `effective["agents.disable"]`, cap interview rounds at `effective["interview.max_rounds"]`, etc.

### Effective config vs user config
- **`config`** = only the keys the user actually supplied (for auditability)
- **`effective`** = DEFAULTS ⊕ config — what skills actually use

Skills log `config` (short and specific) and use `effective` (complete).

---

## Specialist Convention

Domain plugins register specialist agents through a `specialists.md` convention. See [`shared/specialist-convention.md`](specialist-convention.md) for the full specification.

### Domain Plugins

Domain plugins live in `packages/domain/<domain-name>/`. Each provides:
- `specialists.md` — agent routing (detection, story creation, development, review)
- `agents/` — domain-specific agent definitions
- `knowledge/` — domain knowledge base (bible, slices, troubleshooting)
- `skills/` — domain-specific skills
- `rules/` — domain-specific routing rules (e.g., `agent-routing.md`)
- `scripts/` — domain-specific tooling
- `templates/` — domain-specific starters and templates

Available domains:

| Domain | Location | Agents | Description |
|--------|----------|--------|-------------|
| OPNet | `packages/domain/opnet/` | 18 | Bitcoin L1 smart contract platform |

### Discovery Order

1. Story's `## Specialist Context` section
2. Domain plugin `specialists.md` files (in `packages/domain/*/`)
3. Domain plugin `agent-routing.md` rules (in `packages/domain/*/`)
4. Project context file `## Specialists` section
5. Loaded rules/prompt files with domain routing

### Runtime Built-in Agents (NOT shipped by cadence)

These agents are provided by the runtime (Claude Code, Pi, etc.) — cadence references them from skills but does not ship them:

| Agent | Purpose | Source |
|-------|---------|--------|
| `code-reviewer` | General code quality, patterns, maintainability | Runtime built-in |
| `security-reviewer` | Security vulnerabilities, secrets, OWASP top 10 | Runtime built-in |
| `tdd-guide` | TDD enforcement | Runtime built-in |
| `architect` | System design and architectural decisions | Runtime built-in |
| `planner` | Implementation planning | Runtime built-in |
| `go-reviewer` | Idiomatic Go review (auto-detected on Go files) | Runtime built-in |
| `python-reviewer` | PEP 8 / Pythonic review (auto-detected on Py files) | Runtime built-in |

If a runtime doesn't ship one of these, the skill degrades gracefully — the corresponding review stage simply doesn't contribute findings. Do NOT add these to `shared/agents/` unless cadence is taking over ownership of the implementation.

---

## Sprint Lifecycle

### Starting a New Sprint
1. Archive current board to `Archive/Sprint-YYYY-MM-DD.md`
2. Create fresh `Sprint/Board.md`
3. Pull "Refined" items from Backlog into "Ready"

### Sprint Retro
1. Read `Sprint/Board.md` — summarize Done, still In Progress
2. Create `Notes/Retros/YYYY-MM-DD.md`

### Velocity Tracking
Count completed vs remaining story points per sprint.

---

## Release Lifecycle

### Versioning (Semantic Versioning)
- **MAJOR** — breaking changes
- **MINOR** — new features
- **PATCH** — bug fixes

### Release Steps
1. Read `CHANGELOG.md` `[Unreleased]` and `git log` to determine version
2. Create `Archive/Release-vX.Y.Z.md` with checklist
3. Cut release branch from develop
4. Bump version in source files
5. Update CHANGELOG — move `[Unreleased]` to `[vX.Y.Z] - YYYY-MM-DD`
6. Run full test suite
7. Merge to master (no-ff), tag, push
8. Back-merge to develop, push
9. Create GitHub Release
10. Delete release branch

### Quick Release
Skip release branch — merge develop directly to master. Still tag, update CHANGELOG, create GitHub Release.

### Hotfix
1. Branch from master
2. Fix, PR → master + develop (cherry-pick or merge)

---

## Git Workflow

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

## Git Worktrees

Git worktrees are the **mandatory** isolation mechanism for all story work. Every piece of code work MUST happen in a worktree — never directly on develop, master, or an in-repo feature branch.

### Why Worktrees

Worktrees allow multiple sessions to work on different stories simultaneously without interference:
- Each worktree is a full working directory tied to its own branch
- Shared git objects (no duplication)
- No "dirty working tree" conflicts between sessions
- Clean branch-per-story history

### Worktree Directory Layout

```
C:\Github\my-project\                  ← main repo (develop branch)
C:\Github\my-project-worktrees\
  ├── STORY-auth-login\                ← worktree on feature/STORY-auth-login
  ├── STORY-payment-flow\              ← worktree on feature/STORY-payment-flow
  └── STORY-user-settings\             ← worktree on feature/STORY-user-settings
```

### Creating a Worktree

```bash
git fetch origin
# Creates a worktree on a new feature branch from develop
git worktree add -b feature/STORY-<name> ../<repo>-worktrees/STORY-<name> develop

# Switch into it
cd ../<repo>-worktrees/STORY-<name>
```

After entering a worktree, symlink gitignored files from the main repo:
```bash
MAIN_REPO=$(git -C "$(git rev-parse --git-common-dir)" rev-parse --show-toplevel 2>/dev/null || echo "")
for f in .env .env.local .env.development .env.test; do
  [ -f "$MAIN_REPO/$f" ] && [ ! -f "$f" ] && ln -s "$MAIN_REPO/$f" "$f"
done
```

### Exiting / Cleaning Up a Worktree

After the PR is merged (or if abandoned):

```bash
# From inside the worktree, return to main repo
cd <path-to-main-repo>

# Remove the worktree (cleans up the worktree directory + branch reference)
git worktree remove ../<repo>-worktrees/STORY-<name>
git branch -d feature/STORY-<name> 2>/dev/null || true
```

### Rules
- NEVER commit directly to `master` or `develop` — always use a worktree
- Every story gets its own worktree on a feature branch
- Worktrees are short-lived (removed after PR merge)
- Always `git fetch` before creating a new worktree
- Symlink `.env` and other gitignored config files immediately after entering a worktree

### Branch → Environment Mapping

| Branch | Environment |
|--------|-------------|
| `feature/*`, `hotfix/*` (in worktree) | Preview |
| `develop` (main repo) | Staging / Testnet |
| `release/*` (main repo only) | Release Candidate |
| `master` (main repo only) | Production / Mainnet |

Releases and hotfixes always run from the **main repo**, never from a worktree.

---

## Multi-Project Rules

- NEVER modify another project's vault files unless explicitly asked
- Each session operates within its own project folder
- Cross-project references use `[[ProjectName/file]]` wiki-link syntax
- The Obsidian vault is shared across all sessions — board updates are immediate

---

## Adding a New Project

1. Create folder: `<Obsidian_Vaults>/<ProjectName>/`
2. Create subfolders: `Sprint/`, `Backlog/Epics/`, `Backlog/Stories/`, `Specs/Features/`, `Specs/Technical/`, `Specs/API/`, `Learning/Integrations/`, `Learning/Patterns/`, `Learning/Writeups/`, `Research/`, `Notes/Decisions/`, `Notes/Daily/`, `Notes/Retros/`, `Archive/`
3. Create `Sprint/Board.md` and `Backlog/Product-Backlog.md` from templates
4. Create `Roadmap.md`
5. Ensure `_Knowledge/` structure exists at vault level
6. Add `## Obsidian Project` section to code repo's context file
