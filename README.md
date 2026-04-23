# Agentic Cadence

Agent workflow framework for AI coding agents. Socratic interviews clarify requirements before work starts. Specialist guilds provide domain expertise. Structured stories with ontology gates prevent solving the wrong problem. TDD enforcement, automated review cycles, and a learning knowledge base close the loop.

**Works with Claude Code and Pi. Domain plugins for any stack.**

## What It Does

- **Socratic interviews** — clarify vague requirements through structured questioning (Ontologist, Breadth Keeper, Simplifier) before creating stories
- **Ontology gate** — 4 fundamental questions prevent stories that treat symptoms instead of root causes
- **Specialist guilds** — auto-detect project type, dispatch domain experts during development and review
- **Kanban boards** in Obsidian for sprint and backlog management
- **Structured stories** with acceptance criteria, testing strategy, specialist context, and interview notes
- **Git branch isolation** — one feature branch per story (worktrees on Claude Code)
- **TDD enforcement** — tests-first workflow with 80%+ coverage target
- **Automated review cycles** — parallel review agents with fix/re-review loop (max 3 cycles)
- **Hard quality gates** — tests must pass, no CRITICAL findings
- **Learning system** — builds educational knowledge base from completed stories across projects
- **Domain plugins** — OPNet Bitcoin L1 plugin included (17 agents, 27 real-bug patterns, TLA+ verification)

## Monorepo Structure

```
agentic-cadence/
├── shared/                           # ← Single source of truth
│   ├── core.md                       # All conventions (vault, boards, stories, git, etc.)
│   ├── specialist-convention.md      # Domain plugin integration spec
│   ├── build.mjs                     # Generates package outputs from shared core
│   ├── research/                     # Analysis documents
│   └── templates/vault/              # 13 Obsidian templates
│
├── packages/
│   ├── claude/                       # Claude Code plugin
│   │   ├── skills/                   # 12 skills (/cadence:*)
│   │   ├── build/                    # Claude-specific fragments
│   │   ├── rules/                    # ← Generated from shared/ + build/
│   │   ├── hooks/                    # Session exit warning
│   │   ├── agents/                   # PM agent
│   │   ├── .claude-plugin/           # Plugin manifest
│   │   └── install.sh                # One-command setup
│   │
│   ├── pi/                           # Pi package
│   │   ├── .pi/
│   │   │   ├── skills/               # 11 skills (/skill:cadence-*)
│   │   │   ├── extensions/           # Session exit hook + shortcuts
│   │   │   └── prompts/              # ← Generated from shared/ + build/
│   │   ├── build/                    # Pi-specific fragments
│   │   └── package.json              # Pi manifest
│   │
│   └── domain/
│       └── opnet/                    # OPNet Bitcoin L1 domain plugin
│           ├── specialists.md        # Agent routing (detection, dev, review)
│           ├── agent-routing.md      # Trigger-based agent invocation rules
│           ├── agents/               # 17 domain-specific agents
│           ├── knowledge/            # 11 knowledge slices + 2003-line bible
│           ├── skills/               # 3 skills (pua, audit-from-bugs, verify-spec)
│           ├── scripts/              # TLA+ verification tooling
│           └── templates/            # Contract starters
│
└── package.json                      # npm run build
```

## How It Works

1. **Edit** `shared/core.md` — the single source of truth for all conventions
2. **Run** `npm run build` — generates Claude rules + Pi prompts from shared core
3. **Each package** adds its own agent-specific behavior (worktrees for Claude, extensions for Pi)

### Shared Core (`shared/core.md`)

Agent-agnostic conventions:
- Vault structure and folder layout
- Board formats (Kanban plugin-compatible markdown)
- Story format and lifecycle stages
- **Story Interview Protocol** — Socratic questioning with 4 roles
- **Ontology Gate** — mandatory 4-question quality check (Essence, Root Cause, Prerequisites, Hidden Assumptions)
- Git branch strategy and commit format
- Learning system (cross-cutting vs project-specific)
- Review cycle (findings ledger, structured repair, hard gates)
- Sprint and release lifecycle
- Specialist convention (domain plugin system)

### Claude-Specific (`packages/claude/`)

Builds on shared core with:
- `EnterWorktree`/`ExitWorktree` enforcement (non-negotiable)
- `Agent` tool for specialist consultation
- `$ARGUMENTS` syntax in skills
- Claude Code hooks (session exit warning)

### Pi-Specific (`packages/pi/`)

Builds on shared core with:
- Git branch creation (no worktree tool needed)
- TypeScript extension for session events
- `/board`, `/pickup`, `/done`, `/review`, `/learn`, `/interview` shortcut commands

### Domain Plugins (`packages/domain/`)

Domain plugins provide specialist agents, knowledge, and skills for specific tech stacks:
- `specialists.md` — detection rules, agent routing for story/dev/review phases
- `agents/` — domain-specific agent definitions
- `knowledge/` — domain knowledge base (slices, bible, troubleshooting)
- `skills/` — domain-specific skills
- `rules/` — automatic agent invocation triggers

**Included**: OPNet Bitcoin L1 plugin (17 agents, 27 real-bug security patterns, TLA+ formal verification, exhaustive problem-solving methodology)

## Install

### Claude Code

```bash
cd packages/claude
bash install.sh
claude --plugin-dir .
```

### Pi

```bash
pi install git:github.com/shoebillrexmail-cmyk/agentic-cadence.git
```

Or project-local:
```bash
pi install git:github.com/shoebillrexmail-cmyk/agentic-cadence.git -l
```

## Commands

### Claude Code (`/cadence:*`)

| Command | Description |
|---------|-------------|
| `/cadence:init <project>` | Initialize a new project with vault structure |
| `/cadence:board` | Show sprint board and backlog status |
| `/cadence:interview <desc>` | Socratic interview to clarify a feature |
| `/cadence:story <desc>` | Create a user story (includes ontology gate) |
| `/cadence:sprint` | Manage sprints (start, archive, retro) |
| `/cadence:pickup [story]` | Pick up a story + create worktree |
| `/cadence:done` | Complete story, create PR, run review |
| `/cadence:review` | Run automated code review with fix cycles |
| `/cadence:learn` | Extract learnings from completed story |
| `/cadence:spike <question>` | Research spike |
| `/cadence:sync` | Sync vault to match current conventions |
| `/cadence:release` | Create a release |

### Pi (`/skill:cadence-*` or shortcuts)

| Shortcut | Skill | Description |
|----------|-------|-------------|
| `/board` | `/skill:cadence-board` | Show sprint board |
| `/pickup` | `/skill:cadence-pickup` | Pick up a story |
| `/done` | `/skill:cadence-done` | Complete story + PR |
| `/review` | `/skill:cadence-review` | Run code review |
| `/learn` | `/skill:cadence-learn` | Extract learnings |
| `/interview` | `/skill:cadence-interview` | Socratic interview |
| — | `/skill:cadence-init` | Initialize project |
| — | `/skill:cadence-story` | Create user story |
| — | `/skill:cadence-sprint` | Manage sprints |
| — | `/skill:cadence-spike` | Research spike |
| — | `/skill:cadence-sync` | Sync vault structure |

## Story Lifecycle

```
Icebox → [Optional: Socratic Interview] → Needs Refinement → Refined → Ready
  → In Progress → In Review → Done
                    ↑
          Doc Gate → PR → Review Cycle → Hard Gates → Learn
```

### Interview Protocol

When a feature description is vague, run a Socratic interview first:

1. **Round 1**: Scope & Essence — "What IS this, really?"
2. **Rounds 2-4**: Deepen & Challenge — root cause check, non-goals, assumptions, breadth tracking, simplification
3. **Round 5**: Closure check — scope, non-goals, outputs, verification all explicit?

Four perspectives cycle through the interview:

| Role | Purpose |
|------|---------|
| **Socratic Interviewer** | Reduce ambiguity through targeted questions |
| **Ontologist** | Find the root problem, not symptoms |
| **Breadth Keeper** | Prevent collapse onto one sub-topic |
| **Simplifier** | Challenge scope, cut complexity |

### Ontology Gate

Every story passes through 4 mandatory questions before creation:

| Question | Purpose |
|----------|---------|
| **Essence**: What IS this, really? | Strip away surface details |
| **Root Cause**: Root cause or symptom? | Ensure we solve the fundamental issue |
| **Prerequisites**: What must exist first? | Surface hidden dependencies |
| **Hidden Assumptions**: What are we assuming? | Surface implicit beliefs |

If a story is treating a symptom, it gets split. If prerequisites are missing, they become separate stories. If assumptions are wrong, the story gets rewritten.

## Development

### Building

```bash
npm run build          # Build both packages + validate domains
npm run build:claude  # Claude only
npm run build:pi      # Pi only
npm run build:domain  # Validate domain packages only
```

### Adding a New Convention

1. Edit `shared/core.md` with the new convention
2. If Claude needs agent-specific behavior, add a fragment in `packages/claude/build/`
3. If Pi needs agent-specific behavior, add a fragment in `packages/pi/build/`
4. Update `shared/build.mjs` if the assembly order changes
5. Run `npm run build`
6. Test both packages

### Adding a Domain Plugin

1. Create `packages/domain/<name>/` with:
   - `specialists.md` — detection rules, agent routing tables, domain rules, test types
   - `agents/` — domain-specific agent definitions
   - `knowledge/` — domain knowledge (bible, slices, troubleshooting)
   - `skills/` — domain-specific skills (optional)
   - `rules/` — auto-trigger routing (optional)
2. Add a `package.json` with `"name": "@cadence/domain-<name>"`
3. Run `npm run build:domain` to validate
4. Update `shared/core.md` Domain Plugins table

### Prerequisites

- [Claude Code](https://code.claude.com) CLI (for Claude package)
- [Pi](https://shittycodingagent.ai) (for Pi package)
- [Obsidian](https://obsidian.md) with **Kanban** and **Tasks** plugins
- Git + GitHub CLI (`gh`)

## Architecture Origins

Agentic Cadence synthesizes ideas from three sources:

| Source | What We Adopted |
|--------|----------------|
| **Ouroboros** (Q00/ouroboros) | Socratic Interviewer, Ontologist (4 questions), Breadth Keeper, Simplifier, Seed Closer, 3-stage evaluation pipeline |
| **OPNet Knowledge** (opnet-knowledge) | 17 domain specialist agents, 27 real-bug audit patterns, PUA exhaustive problem-solving, TLA+ formal verification, cross-layer validation |
| **Original agile-flow** | Obsidian vault integration, Kanban boards, learning system, specialist convention, git workflow, TDD enforcement |

See [`shared/research/ouroboros-analysis.md`](shared/research/ouroboros-analysis.md) for the full analysis.

## License

MIT
