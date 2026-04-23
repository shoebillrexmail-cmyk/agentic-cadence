# Story: {{Story Name}}

**Epic**: [[EPIC-name]]
**Branch**: `feature/STORY-{{story-name}}`
**Points**: 1 | 2 | 3 | 5 | 8 | 13
**Priority**: ⏫ High | 🔼 Medium | 🔽 Low
**Status**: Icebox | Needs Refinement | Refined | Ready | In Progress | In Review | Done
**PR**: (link when created)

## User Story
As a **[role]**,
I want **[capability]**,
so that **[benefit]**.

## Interview Notes
*(Populated if `cadence-interview` was run before story creation)*

### Clarified Scope
[What we're building, in specific terms]

### Root Problem (vs Symptom)
[The actual problem this solves — confirmed not a symptom]

### Non-Goals
[Explicitly out of scope]

### Hidden Assumptions
[Assumptions surfaced and confirmed or rejected]

### Simplification
[What was cut or simplified from the original ask]

### Verification Expectations
[How success will be judged]

## Specs
- [[Specs/Features/SPEC-feature-name]] — Feature spec
- [[Specs/Technical/SPEC-tech-name]] — Technical spec (if applicable)

## Specialist Context

**Project type**: [e.g. Go backend, Python API, React frontend, etc.]
**Domain**: [matched domain plugin, if any — e.g. none, or domain name from specialists.md]
**Specialists consulted**: [list of specialist agents consulted during story creation]
**Key recommendations**:
- [recommendation from specialist consultation]

**Specialist agents for development**: [agents available during pickup — from domain config + built-in]
- [agent 1] — [purpose]
- [agent 2] — [purpose]

**Domain rules**: [constraints from domain specialist config, if any]

**Known pitfalls**:
- [pitfall from specialist consultation]

## Acceptance Criteria
- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]

## Testing Strategy

**Test framework**: [detected or recommended: jest/vitest/pytest/go test/as-pect]
**Coverage target**: 80%+
**TDD required**: Yes — write tests FIRST, then implement

### Unit Tests
- [ ] Test [function/component] — [scenario]
- [ ] Test [function/component] — [edge case]

### Integration Tests
- [ ] Test [API/module interaction] — [scenario]

### Domain-Specific Tests (if domain plugin defines additional test types)
- [ ] Test [domain-specific scenario]

### E2E Tests (if user-facing flow)
- [ ] Test [user flow] — [end-to-end scenario]

## Tasks
- [ ] Set up test infrastructure (if needed)
- [ ] Write unit tests (RED phase)
- [ ] Implement [component 1]
- [ ] Write integration tests
- [ ] Implement [component 2]
- [ ] Write E2E tests (if applicable)
- [ ] Verify all tests pass (GREEN phase)
- [ ] Refactor (IMPROVE phase)
- [ ] Verify coverage >= 80%

## Notes

---
*Created: {{date}}*
