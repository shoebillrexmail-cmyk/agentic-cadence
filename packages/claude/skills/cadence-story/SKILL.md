---
description: Create a new user story with structured spec, testing strategy, and specialist consultation
---

Create a new user story. The argument "$ARGUMENTS" describes what the story is about.

## Step 0: Load Cadence Config

Before anything else, load per-project overrides:

1. Find `CLAUDE.md` at the repo root
2. Run via Bash: `node shared/scripts/parse-cadence-config.mjs <path-to-CLAUDE.md>`
3. Parse JSON: `{ config, warnings, effective }`
4. Log warnings + applied config to the user (see the Cadence Config section in shared/core.md)
5. Apply to downstream steps:
   - `effective["story.skip_interview_for_clear_requests"]` — if false, always suggest running `/cadence:interview` even for clear specs
   - `effective["story.require_structured_spec"]` — if false, `seed-architect` in Step 5 becomes optional (skip for trivial UI tweaks, still run for state-machine stories)
   - `effective["agents.disable"]` — when about to Task-invoke any agent (seed-architect, contrarian, ontology-analyst, ontologist), if its name is in this list, skip with a log
   - `effective["interview.auto_trigger_on_vague"]` — if false, don't auto-trigger `/cadence:interview` when the request is vague; just proceed with what the user gave

Missing parser or context file → proceed with all defaults.

## Step 1: Initial Setup

1. Generate a kebab-case story name from the description (e.g. "auth-login", "payment-checkout")
2. Find the project's vault path from the repo's CLAUDE.md under `## Obsidian Project`

## Step 2: Detect Project Type and Discover Specialists

Before writing anything, detect what kind of project this is.

**General detection (built-in):**
- Check for `.go` files or `go.mod` → Go project
- Check for `.py` files or `pyproject.toml`/`requirements.txt` → Python project
- Check for `.tsx`/`.jsx` files or React deps → Frontend project
- Check for Express/Fastify/NestJS → Backend project
- Check for `prisma/`, `drizzle/`, or migration dirs → Database project
- Check for existing test framework (`jest.config`, `vitest.config`, `pytest.ini`, `*_test.go`) → Note test tooling

**Domain specialist discovery (MANDATORY — check ALL sources):**
Search for specialist configurations from every discovery source. These are additive, not alternatives:
1. **Loaded rules** in `~/.claude/rules/` — scan for files containing domain-specific routing logic (detection criteria, agent trigger tables). If the project matches a routing file's detection criteria, all its agents, rules, and triggers are active and binding.
2. **Installed plugin `specialists.md` files** — domain plugins may provide structured specialist configs.
3. **Project CLAUDE.md** — a `## Specialists` section may point to specific configs.

For each discovered specialist config or routing rule, check its **Detection** rules against the current project. If detection matches, load that domain's agents, rules, and test types.

**Build a specialist roster** from all matches. Always include these general-purpose agents:

| Always Available | Purpose |
|-----------------|---------|
| `code-reviewer` | General code quality, patterns, maintainability |
| `security-reviewer` | Security vulnerabilities, secrets, OWASP top 10 |
| `tdd-guide` | Test-driven development enforcement |
| `architect` | System design and architectural decisions |

Plus language-specific reviewers (built into Claude Code):
| Detected | Agent |
|----------|-------|
| Go | `go-reviewer` |
| Python | `python-reviewer` |

Plus any domain-specific agents from discovered specialist configs.

## Step 3: Specialist Consultation on Approach

Launch specialist agents (based on detected project type and discovered domain configs) to provide feedback on the described feature.

**Prompt each specialist with:**
- The feature description from the user
- The detected project type and tech stack
- Ask: "What are the key technical considerations, risks, and recommended approach for implementing this? What testing strategy would you recommend? Are there common pitfalls to avoid?"

**If domain plugins provide MCP tools** (from the specialist config's MCP Tools section), use them for additional guidance and known pitfall queries.

Capture all specialist feedback — it feeds into the spec and testing strategy.

## Step 4: Generate Testing Strategy

Based on the project type, feature description, and specialist feedback, determine which test types are needed:

### Built-in Test Types (always considered)

| Test Type | When Required | Framework Detection |
|-----------|--------------|-------------------|
| **Unit Tests** | ALWAYS — every story must have unit tests | jest/vitest/pytest/go test/mocha |
| **Integration Tests** | When feature touches APIs, databases, external services, or cross-module boundaries | Same frameworks + test DBs, supertest, httptest |
| **E2E Tests** | When feature has user-facing flows, critical paths, or multi-step interactions | Playwright, Cypress |
| **Security Tests** | When feature handles auth, user input, payments, secrets, or permissions | Custom assertions, OWASP checks |
| **Performance Tests** | When feature has explicit performance requirements or handles high throughput | k6, artillery, benchmark tests |

### Domain-specific Test Types
If domain specialist configs define additional test types (in their Test Types section), include them when their conditions are met.

Generate concrete test requirements for each applicable type.

## Step 5: Generate Structured Spec Fields

Before writing the story file, delegate to shared agents to produce the machine-verifiable spec fields. All three Task calls happen in parallel where inputs don't depend on each other.

1. **Task → `seed-architect`** with: clarified scope from Steps 3-4, any non-goals, interview notes if `/cadence:interview` ran first, and project context from Step 2. Expect a structured block with **GOAL**, **CONSTRAINTS**, **NON_GOALS**, **EVALUATION_PRINCIPLES** (weights sum to 1.0), **EXIT_CONDITIONS** (mechanically checkable), and **ONTOLOGY** (entities + relations).

2. **(Optional) Task → `contrarian`** with the clarified scope and the stated assumptions surfaced so far. Expect an inversion table with plausibility scores. If any HIGH-plausibility inversion appears → surface to the user before proceeding. LOW/MEDIUM inversions get documented in the story's `## Assumption Stress Test` section.

3. **(Optional, for state-machine or multi-entity stories) Task → `ontology-analyst`** with the stub ONTOLOGY from seed-architect. Expect a full domain model (entities, relationships, state transitions, cross-entity invariants). Skip for trivial UI-tweak or config-only stories.

The seed-architect output is embedded verbatim into the story's `## Structured Specification` section. The ontology-analyst output (if generated) is embedded into the story's `## Domain Model` section.

## Step 6: Create the Story File

Create `Backlog/Stories/STORY-<name>.md` using this format:

```markdown
# Story: <Descriptive Name>

**Epic**: (ask user or leave as TBD)
**Branch**: `feature/STORY-<name>`
**Points**: (estimate based on complexity: 1, 2, 3, 5, 8, 13)
**Priority**: (ask user or infer: ⏫ High | 🔼 Medium | 🔽 Low)
**Status**: Needs Refinement
**PR**: —

## User Story
As a **[role]**,
I want **[capability]**,
so that **[benefit]**.

## Specs
- [[Specs/Features/SPEC-<name>]]
- [[Specs/Technical/SPEC-<name>]] (if applicable)

## Specialist Context

**Project type**: [detected type(s)]
**Domain(s)**: [matched domain plugin names, if any]
**Specialists consulted**: [list of specialist agents]
**Key recommendations**:
- [recommendation 1 from specialist]
- [recommendation 2 from specialist]

**Specialist agents for development**: [agents available during pickup — from domain config's Development section]

**Domain rules**: [key rules from domain config — constraints to follow]

**Known pitfalls**:
- [pitfall 1]
- [pitfall 2]

## Structured Specification
(populated verbatim from the `seed-architect` agent output in Step 5)

**GOAL**: [one observable sentence]

**CONSTRAINTS**:
- [hard limit]

**NON_GOALS**:
- [out of scope]

**EVALUATION_PRINCIPLES** (weights sum to 1.0):
- [name]:[description]:[weight]

**EXIT_CONDITIONS**:
- [name]:[mechanically checkable criterion]

**ONTOLOGY**:
- [entity]:[attributes]:[relations]

## Domain Model
(optional — populated from `ontology-analyst` output for state-machine or multi-entity stories; omit otherwise)

## Assumption Stress Test
(optional — populated from `contrarian` output; list any HIGH-plausibility inversions the user accepted, plus notable MEDIUM inversions)

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]
(generate 3-5 meaningful acceptance criteria from the feature description and specialist feedback)

## Testing Strategy

**Test framework**: [detected or recommended]
**Coverage target**: 80%+
**TDD required**: Yes — write tests FIRST, then implement

### Required Test Types
(include only applicable types — built-in + domain-specific)

#### Unit Tests
- [ ] [concrete test requirement]

#### Integration Tests
- [ ] [concrete test requirement]

#### [Domain-specific test type name] (if applicable)
- [ ] [concrete test requirement]

#### E2E Tests (if applicable)
- [ ] [concrete test requirement]

## Tasks
- [ ] Set up test infrastructure (if not already present)
- [ ] Write unit tests (RED phase — tests should fail)
- [ ] Implement [component/feature 1]
- [ ] Write integration tests
- [ ] Implement [component/feature 2]
- [ ] Write E2E tests (if applicable)
- [ ] Verify all tests pass (GREEN phase)
- [ ] Refactor (IMPROVE phase)
- [ ] Verify coverage >= 80%

## Notes
[Specialist feedback summary, architectural decisions, constraints]
```

## Step 7: Create the Spec

**Always** create a feature spec at `Specs/Features/SPEC-<name>.md`:

Use the feature spec template but ensure these sections are filled:
- **Testing Strategy** — populated from Step 4 with concrete requirements per test type
- **Specialist Considerations** — captured from Step 3 consultation (domain rules, recommendations)
- **Edge Cases** — informed by specialist feedback and known pitfalls
- **Security Considerations** — from security-reviewer perspective

**If the story involves technical architecture** (new services, data models, APIs), also create `Specs/Technical/SPEC-<name>.md` with the technical spec template.

## Step 8: Ontology Gate (MANDATORY)

**Task → `ontologist`** in `gate-only` mode with the full story file content as the target. The agent returns the 4-question verdict table plus a binding decision: `PROCEED | SPLIT | REWRITE | BLOCK`.

The 4 fundamental questions (handled by the ontologist agent):

| # | Question | Check |
|---|----------|-------|
| 1 | **Essence**: "What IS this, really?" | Does the story describe the core problem, not surface symptoms? |
| 2 | **Root Cause**: "Is this the root cause or a symptom?" | Does the story address the fundamental issue? |
| 3 | **Prerequisites**: "What must exist first?" | Are all dependencies present or captured as separate stories? |
| 4 | **Hidden Assumptions**: "What are we assuming?" | Are implicit assumptions documented in the story? |

Act on the ontologist's verdict:
- `PROCEED` → Story is well-formed, continue to Step 9
- `SPLIT` → Tell user: "This story appears to treat a symptom of [deeper issue]. Should we create a root-cause story instead? Or treat the symptom intentionally?"
- `REWRITE` → Apply the ontologist's listed corrections to the clarified scope, **then jump back to Step 5 and re-run `seed-architect`** with the corrected scope (the structured fields depend on scope). Re-gate after seed-architect emits the new block. Prose-only edits to the story without re-running seed-architect risk leaving stale GOAL/CONSTRAINTS.
- `BLOCK` → Missing prerequisites — create prerequisite stories first, then re-gate (prerequisites rarely require a seed-architect re-run, only if they change CONSTRAINTS)

Do NOT skip this gate. It prevents stories that solve the wrong problem.

## Step 9: Quality Gate

Validate the story against completeness and testability checks:

**Completeness:**
- [ ] User story has clear role, capability, and benefit
- [ ] At least 3 acceptance criteria with Given/When/Then format
- [ ] Testing strategy has at least unit tests defined
- [ ] Each acceptance criterion has a corresponding test requirement
- [ ] Specialist context is documented (project type, agents, pitfalls)
- [ ] Tasks include TDD workflow steps (write tests → implement → verify)
- [ ] Ontology Gate passed (Step 8 — verdict `PROCEED` from `ontologist`)
- [ ] Structured Specification present (from `seed-architect` in Step 5)

**Testability:**
- [ ] Every acceptance criterion is automatable (not subjective)
- [ ] Test framework is identified
- [ ] Test types are appropriate for the feature scope

**Specialist review:**
- [ ] At least one specialist was consulted (general or domain-specific)
- [ ] Known pitfalls are documented
- [ ] Specialist recommendations are reflected in the approach

If any check fails, fix it before proceeding.

## Step 10: Add to Backlog and Next Steps

1. Add the story to `Backlog/Product-Backlog.md` under "Needs Refinement"
2. Report to user:
   - Story summary
   - Ontology Gate result (root problem, assumptions surfaced)
   - Specialist findings (general + domain-specific)
   - Testing strategy overview
   - Story point estimate with rationale
3. Ask: "Want to refine further, pull into the sprint, or create more stories?"
