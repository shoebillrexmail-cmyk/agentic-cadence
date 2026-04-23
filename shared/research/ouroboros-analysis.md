# Agent Ecosystem Analysis — Ouroboros + OPNet Knowledge → cadence

## What We Have Today

### cadence (shared/core.md)
**20 generic agents** covering the full agile lifecycle: story creation, pickup, TDD, review, learning. Strong on process, weak on depth.

### opnet-knowledge (C:\Github\opnet-knowledge)
**18 domain-specific agents** for OPNet Bitcoin L1 development:
- 3 builders: `opnet-contract-dev`, `opnet-frontend-dev`, `opnet-backend-dev`
- 5 auditors: `opnet-auditor` (27-pattern checklist), `opnet-adversarial-auditor`, `spec-auditor` (TLA+), `spec-writer`, `cross-layer-validator`
- 4 optimizers/analyzers: `contract-optimizer`, `frontend-analyzer`, `backend-analyzer`, `dependency-auditor`
- 2 planners: `migration-planner`, `opnet-deployer`
- 2 testers: `opnet-e2e-tester`, `opnet-ui-tester`
- 2 specialists: `spec-writer` (TLA+), `opnet-adversarial-tester`
- 3 skills: `pua` (exhaustive problem-solving), `audit-from-bugs` (27 real-bug patterns), `verify-spec` (TLA+)
- ~12K lines of domain knowledge slices

Plus a `specialists.md` file that integrates with cadence's domain plugin convention.

### Ouroboros (Q00/ouroboros)
**23 agents** organized around specification-first workflow:
- Interview: `socratic-interviewer`, `breadth-keeper`, `seed-closer`
- Analysis: `ontologist`, `ontology-analyst`, `contrarian`, `simplifier`, `architect`
- Evaluation: `evaluator` (3-stage), `semantic-evaluator`, `qa-judge`, `advocate`, `judge`, `consensus-reviewer`
- Execution: `code-executor`, `research-agent`, `analysis-agent`
- Orchestration: `seed-architect`, `researcher`, `hacker`, `codebase-explorer`

---

## Gap Analysis: What Each Repo Has That Others Don't

### Ouroboros has, cadence lacks

| Capability | Ouroboros Agent | Why It Matters |
|---|---|---|
| **Requirement clarification** | Socratic Interviewer | Vague input → garbage story. Ouroboros forces 2-5 rounds of Socratic questioning BEFORE generating specs. Our `/agile-story` takes whatever the user says and runs with it. |
| **Anti-symptom detection** | Ontologist (4 fundamental questions) | "Fix login page" might be a symptom of session management. Ouroboros asks: "Is this the root cause or a symptom?" before writing specs. We don't. |
| **Multi-track awareness** | Breadth Keeper | User says "I need auth + payments + notifications". Our story creation collapses onto the most interesting sub-topic. Breadth Keeper prevents this. |
| **Assumption inversion** | Contrarian | "What if the opposite of our assumption is true?" Catches stories built on wrong assumptions. We never challenge assumptions. |
| **Scope minimization** | Simplifier | "What's the simplest version that could work?" Catches over-engineered stories before they enter the backlog. |
| **Drift detection** | Semantic Evaluator | Measures `goal_alignment` and `drift_score` — did the implementation drift from the original intent? Our review checks code quality but not intent alignment. |
| **Stuck recovery** | Hacker | "Question constraints, bypass entirely, solve a different problem." When development is stuck, no fallback strategy. |
| **Structured specification** | Seed Architect | Machine-verifiable fields (GOAL, CONSTRAINTS, EXIT_CONDITIONS, ONTOLOGY). Our story format is free-form markdown. |
| **Staged evaluation** | Evaluator (3-stage) | Mechanical → Semantic → Consensus. Our review is a flat R1/R2/R3 loop. No separation between "does it build?" and "did we build the right thing?" |
| **Interview termination** | Seed Closer | Knows when to stop interviewing and when to keep going. Prevents over-interviewing (bikeshedding) and premature closure. |

### OPNet Knowledge has, cadence lacks

| Capability | OPNet Agent | Why It Matters |
|---|---|---|
| **Exhaustive problem-solving** | PUA skill | 5-step methodology, 7-point checklist after 3 failures, anti-rationalization table. Our "stuck" handling is non-existent. |
| **27 real-bug patterns** | audit-from-bugs skill | Pattern-based audit from confirmed vulnerabilities (serialization, storage, arithmetic, crypto, etc.). Far more rigorous than generic "security-reviewer". |
| **Formal verification** | spec-writer + spec-auditor | TLA+ specs verified by TLC before code is written. Finds design-level bugs (race conditions, invariant violations) that code review cannot catch. |
| **Adversarial invariant testing** | opnet-adversarial-auditor | Constructs attack sequences to violate stated invariants. Goes beyond pattern matching to active exploitation thinking. |
| **Cross-layer validation** | cross-layer-validator | ABI ↔ frontend ↔ backend consistency. The #1 cause of wasted audit cycles — catches integration bugs before security audit. |
| **Migration planning** | migration-planner | Storage pointer analysis for contract upgrades. On OPNet, wrong pointer order = corrupt state + fund loss. Critical for upgrades. |
| **Domain knowledge slices** | 12K lines of knowledge | Contract dev, frontend dev, backend dev, security audit, E2E testing, deployment, etc. Our agents have zero domain knowledge. |

### cadence has that neither repo does

| Capability | Our Feature | Why It Matters |
|---|---|---|
| **Obsidian vault integration** | Board/backlog/story management | Both repos manage state in flat files. We have interactive Kanban boards in Obsidian. |
| **Learning system** | Cross-cutting + project-specific | Two-tier knowledge architecture with staleness tracking, promotion, deduplication. Neither repo has this. |
| **Domain plugin convention** | specialists.md | Standard interface for any domain to plug in agents, rules, test types, MCP tools. Ouroboros has no plugin system. OPNet uses it but hardcodes OPNet. |
| **Multi-agent parallel review** | Review cycle with structured repair | Launch multiple agents in parallel, collect findings, fix, re-review. Ouroboros has consensus but no repair loop. |
| **Git workflow + branch isolation** | Worktree support | Full gitflow-lite with worktree isolation for parallel sessions. Neither repo has this. |

### Ouroboros and OPNet Knowledge overlap on

| Overlap | Ouroboros | OPNet Knowledge | Notes |
|---|---|---|---|
| Architecture analysis | Architect | (embedded in all agents) | OPNet's is domain-specific, Ouroboros's is generic |
| Research methodology | Researcher | (embedded in specialist agents) | Both do systematic investigation |
| Code execution | Code Executor | opnet-contract-dev, etc. | OPNet agents are domain-specific executors |
| Security review | (none focused) | opnet-auditor + 27 patterns | OPNet wins decisively here |

---

## Integration Recommendations

### Phase 1: Bring OPNet Knowledge into the monorepo (Structural)

**Goal**: Make opnet-knowledge a domain plugin within the cadence monorepo.

```
claude-cadence/
├── shared/
│   ├── core.md                    # ← Already exists
│   └── research/
├── packages/
│   ├── claude/                    # ← Already exists
│   ├── pi/                        # ← Already exists
│   └── domain/                    # ← NEW: domain plugins
│       └── opnet/                 # ← NEW: OPNet domain plugin
│           ├── specialists.md     # ← Already exists (from opnet-knowledge)
│           ├── rules/
│           │   └── agent-routing.md
│           ├── agents/
│           │   ├── opnet-auditor.md
│           │   ├── opnet-contract-dev.md
│           │   ├── opnet-frontend-dev.md
│           │   ├── ... (18 agents)
│           ├── knowledge/
│           │   ├── opnet-bible.md
│           │   └── slices/        # 11 knowledge slices
│           └── skills/
│               ├── pua/SKILL.md
│               ├── audit-from-bugs/SKILL.md
│               └── verify-spec/SKILL.md
```

**Why**: The specialist convention already exists in shared/core.md. OPNet knowledge follows this convention. It just needs to live in the monorepo as a domain package.

### Phase 2: Adopt Ouroboros thinking into shared/core.md (High-Impact)

These are agent-agnostic improvements that apply to ALL domain plugins, not just OPNet:

#### 2A: Story Interview Phase (P0)

**From**: Socratic Interviewer + Ontologist + Breadth Keeper + Seed Closer

Add an optional pre-story interview to the story lifecycle:

```
Current:
  User describes feature → Story created

Enhanced:
  User describes feature
    → [OPTIONAL] Interview phase (2-5 rounds)
       - Socratic questioning to clarify scope, non-goals, verification
       - Ontologist: essence, root cause, prerequisites, assumptions
       - Breadth Keeper: track multiple ambiguity tracks
       - Simplifier: "What's the simplest version that works?"
       - Seed Closer: "Is this ready to spec or do we need more?"
    → Story created (with structured fields)
```

**Integration point**: The `agile-story` skill gains an `--interview` flag. When set, it runs 2-5 rounds of Socratic questioning before writing the story. Without it, existing behavior is preserved.

**What this means for OPNet**: When an OPNet project runs `/agile-story --interview "build a staking contract"`, the interview would also invoke `opnet-contract-dev` for domain-specific clarification: "What token standards? What's the lock period? What happens on early withdrawal?"

#### 2B: Anti-Symptom Story Gate (P0)

**From**: Ontologist

Add the 4 fundamental questions as a quality gate during story creation:

```
For every new story:
  1. ESSENCE: "What IS this, really?"
  2. ROOT CAUSE: "Is this the root cause or a symptom?"
  3. PREREQUISITES: "What must exist first?"
  4. HIDDEN ASSUMPTIONS: "What are we assuming?"

If ROOT CAUSE = symptom:
  → Split the story: one for root cause, one (or reject) for surface fix
```

**What this means for OPNet**: When a user says "fix the frontend error when connecting wallet", the ontologist would ask "Is this a frontend bug or a backend RPC issue?" and route to the right agent.

#### 2C: 3-Stage Evaluation Pipeline (P1)

**From**: Evaluator + Semantic Evaluator

Replace the current flat R1/R2/R3 review with staged evaluation:

```
Current:
  Review → Fix → Re-review (flat loop)

Enhanced:
  Stage 1: Mechanical (lint, build, test, coverage) → BLOCK if fail
  Stage 2: Semantic (AC compliance, goal alignment, drift score) → BLOCK if fail
  Stage 3: Domain Review (domain-specific agents from specialist config)
    + Structured Repair (R1/R2/R3) ← keep existing, but inside Stage 3
  Stage 4: Consensus (if triggered) ← from Ouroboros
```

**What this means for OPNet**: Stage 3 would dispatch `opnet-auditor`, `frontend-analyzer`, `cross-layer-validator` etc. Stage 4 would run the adversarial auditor and spec-auditor for high-stakes stories.

#### 2D: Stuck Detection + PUA Integration (P2)

**From**: Hacker + PUA skill

When the agent fails 3+ times on the same issue:

```
Trigger: 3+ failed attempts on the same problem
  │
  ▼
PUA 7-Point Checklist (mandatory)
  │  - Read failure signals word by word
  │  - Proactive search
  │  - Read raw material
  │  - Verify underlying assumptions
  │  - Invert assumptions
  │  - Minimal isolation
  │  - Change direction
  │
  ▼
Hacker Mode (if PUA checklist doesn't resolve)
  │  - Question every constraint
  │  - Consider bypassing entirely
  │  - Solve a different problem
  │
  ▼
Structured Failure Report (if still stuck)
  - Verified facts, eliminated possibilities, narrowed scope
  - Recommended next directions, handoff information
```

**What this means for OPNet**: When a contract fails to compile with cryptic WASM errors, PUA forces systematic debugging. When a transaction simulation keeps failing, Hacker mode asks "What if we bypass the simulation and test on testnet directly?"

#### 2E: Structured Story Fields (P1)

**From**: Seed Architect

Add machine-verifiable fields to the story format:

```markdown
## Structured Specification
**Goal**: Clear goal statement
**Constraints**: pipe-separated hard limitations
**Non-Goals**: explicitly out of scope
**Evaluation Principles**: name:description:weight
**Exit Conditions**: name:description:criteria
**Ontology**: domain model / data model for this work
```

**What this means for OPNet**: An OPNet story would have:
- Constraints: "OP_NET | AssemblyScript | No Buffer | ML-DSA signatures"
- Evaluation Principles: "gas_efficiency:0.2:1.0 | safety:0.3:1.0 | storage_correctness:0.5:1.0"
- Exit Conditions: "all_tests_pass:All contract tests green | audit_clean:No CRITICAL findings"
- Ontology: "staker:Address | stakeAmount:u256 | rewardRate:u256 | lockPeriod:u64"

### Phase 3: OPNet Knowledge → Shared Core Extraction (P2)

Some patterns in opnet-knowledge are so good they should become part of shared/core.md:

| OPNet Pattern | Generalization for shared/core.md |
|---|---|
| `agent-routing.md` (trigger conditions for agent invocation) | **General agent routing pattern**: "When X condition is met, invoke Y agent" — currently domain-specific, should be a shared convention |
| `audit-from-bugs` 27-pattern checklist | **Pattern-based audit methodology**: Extract the checklist format (CATEGORY: [SEVERITY] PAT-XX) as a template any domain can fill |
| `pua` skill (5-step methodology) | **Stuck recovery protocol**: The 5 steps + 7-point checklist are agent-agnostic |
| `cross-layer-validator` | **Integration validation pattern**: "Validate that layer A's outputs match layer B's inputs" — applies to any multi-layer system |
| `spec-writer` + `spec-auditor` | **Design-first verification**: Write formal specs before code. The concept is agent-agnostic (TLA+ is OPNet-specific, but the principle isn't) |

---

## Revised Agent Landscape (After Integration)

### Generic (shared/core.md — applies to ALL projects)

| Agent Concept | Source | Phase |
|---|---|---|
| Socratic Interviewer | Ouroboros | P0 |
| Ontologist (4 questions) | Ouroboros | P0 |
| Breadth Keeper | Ouroboros | P0 |
| Simplifier | Ouroboros | P0 |
| Contrarian | Ouroboros | P1 |
| Architect (enhanced) | Ouroboros | P1 |
| Seed Closer | Ouroboros | P1 |
| Evaluator (3-stage pipeline) | Ouroboros | P1 |
| Semantic Evaluator | Ouroboros | P1 |
| Hacker | Ouroboros | P2 |
| PUA methodology | OPNet Knowledge | P2 |
| Researcher (disciplined) | Ouroboros | P3 |

### Domain: OPNet (domain/opnet/ — OPNet projects only)

| Agent | Source | Trigger |
|---|---|---|
| opnet-contract-dev | OPNet Knowledge | Writing contract code |
| opnet-frontend-dev | OPNet Knowledge | Writing frontend code |
| opnet-backend-dev | OPNet Knowledge | Writing backend code |
| opnet-auditor | OPNet Knowledge | Reviewing contract code |
| opnet-adversarial-auditor | OPNet Knowledge | Pre-deployment |
| spec-writer | OPNet Knowledge | New contract design |
| spec-auditor | OPNet Knowledge | Design verification |
| cross-layer-validator | OPNet Knowledge | Multi-layer changes |
| dependency-auditor | OPNet Knowledge | Build failures, pre-deployment |
| migration-planner | OPNet Knowledge | Contract upgrades |
| contract-optimizer | OPNet Knowledge | Gas optimization |
| frontend-analyzer | OPNet Knowledge | Frontend review |
| backend-analyzer | OPNet Knowledge | Backend review |
| opnet-deployer | OPNet Knowledge | Deployments |
| opnet-e2e-tester | OPNet Knowledge | E2E testing |
| opnet-ui-tester | OPNet Knowledge | UI testing |
| opnet-adversarial-tester | OPNet Knowledge | Adversarial testing |

### What Gets Added to shared/core.md

1. **Interview protocol** — how to run Socratic interviews before story creation
2. **Ontology gate** — the 4 fundamental questions as a story quality gate
3. **3-stage evaluation pipeline** — Mechanical → Semantic → Domain → Consensus
4. **Stuck recovery protocol** — PUA 5-step methodology + Hacker mode
5. **Agent routing convention** — standardized trigger format for domain plugins
6. **Structured story specification** — machine-verifiable fields in story format
7. **Simplification gate** — pre-backlog scope check

### What Stays in domain/opnet/

1. All 18 domain-specific agents (they have OPNet-specific knowledge)
2. All 12K lines of knowledge slices
3. 27 real-bug pattern checklist
4. TLA+ verification tools
5. Domain rules (Buffer, SafeMath, ML-DSA, etc.)

---

## Implementation Plan

### Step 1: Monorepo structure (this PR)
- Add `packages/domain/opnet/` with all opnet-knowledge content
- Update build script to handle domain packages
- Update shared/core.md specialist convention to reference domain packages

### Step 2: Interview + Ontology gate (next PR)
- Add `agile-interview` skill (Claude + Pi)
- Enhance `agile-story` with `--interview` flag
- Add ontology 4-questions to story creation quality gate
- Add breadth keeper to prevent single-topic collapse

### Step 3: 3-Stage evaluation (next PR)
- Enhance `agile-review` with Mechanical → Semantic → Domain stages
- Add goal alignment and drift score tracking
- Integrate with domain-specific agents (opnet-auditor, cross-layer-validator, etc.)

### Step 4: Stuck recovery (next PR)
- Add PUA methodology to shared/core.md
- Enhance `agile-pickup` with stuck detection
- Add Hacker mode as fallback

### Step 5: Structured story format (next PR)
- Add Seed Architect fields to story template
- Update story creation skill to populate structured fields
- Update evaluation pipeline to verify against structured exit conditions

### Step 6: Generalize OPNet patterns (future)
- Extract agent routing convention from agent-routing.md
- Extract audit methodology from audit-from-bugs
- Extract PUA from pua skill
- Extract integration validation from cross-layer-validator
