---
name: agile-story
description: Create a new user story with structured spec, testing strategy, and specialist consultation. Use when the user describes a new feature, request, or piece of work.
---

# Create User Story

Create a new agile user story. The argument describes what the story is about.

## Step 1: Initial Setup

1. Generate a kebab-case story name from the description (e.g. "auth-login", "payment-checkout")
2. Find the project's vault path from the repo's AGENTS.md under `## Obsidian Project`

## Step 2: Detect Project Type and Discover Specialists

**General detection:**
- `.go` files or `go.mod` → Go project
- `.py` files or `pyproject.toml`/`requirements.txt` → Python project
- `.tsx`/`.jsx` files or React deps → Frontend project
- Express/Fastify/NestJS → Backend project
- `prisma/`, `drizzle/`, or migration dirs → Database project
- Test framework (`jest.config`, `vitest.config`, `pytest.ini`, `*_test.go`) → Note tooling

**Domain specialist discovery:** Check ALL sources:
1. Loaded prompt files for domain routing logic
2. Installed skills' `specialists.md` files
3. Project AGENTS.md `## Specialists` section

Build a specialist roster. Always include:
- `code-reviewer` — general code quality
- `security-reviewer` — security vulnerabilities
- `tdd-guide` — TDD enforcement
- `architect` — design decisions
- Language-specific: `go-reviewer` (Go), `python-reviewer` (Python)

## Step 3: Specialist Consultation

Prompt each specialist with:
- The feature description
- The detected project type and tech stack
- Ask: "What are the key technical considerations, risks, and recommended approach? What testing strategy? Pitfalls to avoid?"

Capture all specialist feedback.

## Step 4: Generate Testing Strategy

### Built-in Test Types (always considered)

| Test Type | When Required |
|-----------|--------------|
| **Unit Tests** | ALWAYS |
| **Integration Tests** | APIs, databases, external services |
| **E2E Tests** | User-facing flows, critical paths |
| **Security Tests** | Auth, input, payments, secrets |
| **Performance Tests** | Explicit perf requirements |

Plus domain-specific test types from specialist configs.

## Step 5: Create the Story File

Create `Backlog/Stories/STORY-<name>.md`:

```markdown
# Story: <Descriptive Name>

**Epic**: (ask user or leave as TBD)
**Branch**: `feature/STORY-<name>`
**Points**: (estimate: 1, 2, 3, 5, 8, 13)
**Priority**: ⏫ High | 🔼 Medium | 🔽 Low
**Status**: Needs Refinement
**PR**: —

## User Story
As a **[role]**, I want **[capability]**, so that **[benefit]**.

## Specs
- [[Specs/Features/SPEC-<name>]]

## Specialist Context
**Project type**: [detected type(s)]
**Specialists consulted**: [list]
**Key recommendations**: [...]
**Domain rules**: [...]
**Known pitfalls**: [...]

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]

## Testing Strategy
**TDD required**: Yes — write tests FIRST, then implement
### Unit Tests
- [ ] [concrete test requirement]
### Integration Tests
- [ ] [concrete test requirement]

## Tasks
- [ ] Set up test infrastructure
- [ ] Write unit tests (RED phase)
- [ ] Implement [component/feature]
- [ ] Write integration tests
- [ ] Verify all tests pass (GREEN phase)
- [ ] Refactor (IMPROVE phase)
- [ ] Verify coverage >= 80%

## Notes
[Specialist feedback summary, architectural decisions]
```

## Step 6: Create the Spec

Create `Specs/Features/SPEC-<name>.md` with:
- Testing Strategy populated
- Specialist Considerations
- Edge Cases
- Security Considerations

If the story involves technical architecture, also create `Specs/Technical/SPEC-<name>.md`.

## Step 7: Ontology Gate (MANDATORY)

Run the 4 fundamental questions before finalizing:

| # | Question | Check |
|---|----------|-------|
| 1 | **Essence**: What IS this, really? | Core problem described, not symptoms |
| 2 | **Root Cause**: Root cause or symptom? | Addressing the fundamental issue |
| 3 | **Prerequisites**: What must exist first? | Dependencies identified |
| 4 | **Hidden Assumptions**: What are we assuming? | Assumptions documented |

**Gate outcomes:**
- All pass → proceed to Step 8
- Root cause = symptom → Tell user, suggest root-cause story
- Missing prerequisites → Add prerequisite stories
- Wrong assumptions → Rewrite with corrected assumptions

## Step 8: Quality Gate

Validate:
- [ ] User story has clear role, capability, benefit
- [ ] At least 3 acceptance criteria with Given/When/Then
- [ ] Testing strategy has at least unit tests defined
- [ ] Specialist context documented
- [ ] Tasks include TDD workflow steps
- [ ] Ontology Gate passed (Step 7)

## Step 9: Add to Backlog

1. Add story to `Backlog/Product-Backlog.md` under "Needs Refinement"
2. Report summary to user
3. Ask: "Want to refine further, pull into the sprint, or create more stories?"
