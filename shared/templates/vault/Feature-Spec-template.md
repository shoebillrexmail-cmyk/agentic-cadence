# Feature Spec: {{Feature Name}}

**Story**: [[STORY-name]]
**Epic**: [[EPIC-name]]
**Status**: Draft | In Review | Approved
**Author**:
**Project type**: [detected type]

## Overview
Brief description of the feature.

## Problem Statement
What problem does this solve and for whom?

## Detailed Requirements

### Functional Requirements
1. Requirement 1
2. Requirement 2

### Non-Functional Requirements
- Performance:
- Security:
- Accessibility:

## User Flows
Describe step-by-step user interactions.

### Flow 1: {{Flow Name}}
1. User does X
2. System responds with Y
3. User sees Z

## Data Model
Describe any new or changed data structures.

## API Changes
Link to API spec if applicable: [[API-endpoint-name]]

## UI/UX
Wireframes, mockups, or descriptions of the interface.

## Specialist Considerations

### Approach Recommendations
(Captured from specialist agent consultation during story creation)
- [recommendation 1]
- [recommendation 2]

### Domain-Specific Rules
(From domain specialist config, if a domain plugin is installed — constraints to follow)

### Known Pitfalls
- [pitfall 1 — from specialist or incident history]
- [pitfall 2]

## Edge Cases
- Edge case 1: how to handle
- Edge case 2: how to handle

## Security Considerations
(From security-reviewer consultation)
- Authentication:
- Authorization:
- Input validation:
- Data sanitization:

## Testing Strategy

### Unit Tests
| Component/Function | Test Scenario | Priority |
|-------------------|---------------|----------|
| [component] | Happy path | Must have |
| [component] | Error case | Must have |
| [component] | Edge case | Should have |

### Integration Tests
| Interaction | Test Scenario | Priority |
|------------|---------------|----------|
| [API endpoint / module boundary] | Valid request/response | Must have |
| [DB operation] | CRUD with real connection | Must have |

### Domain-Specific Tests (if domain plugin defines additional test types)
| Subject | Test Scenario | Priority |
|---------|---------------|----------|
| [domain-specific subject] | [scenario] | Must have |

### E2E Tests
| User Flow | Steps | Priority |
|----------|-------|----------|
| [flow] | [step-by-step] | Must have |

### Test Coverage Target
- Overall: 80%+
- Critical paths: 100%
- Edge cases: documented and tested

## Out of Scope
What this spec explicitly does NOT cover.

## Open Questions
- [ ] Question 1
- [ ] Question 2

---
*Created: {{date}}*
*Last updated: {{date}}*
