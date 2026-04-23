# Technical Spec: {{Component/System Name}}

**Story**: [[STORY-name]]
**Epic**: [[EPIC-name]]
**Status**: Draft | In Review | Approved
**Project type**: [detected type]

## Context
Why is this technical work needed?

## Design

### Architecture
High-level architecture description.

### Components
| Component | Responsibility | Specialist |
|-----------|---------------|-----------|
| | | [agent that should review this] |

### Data Flow
Describe how data moves through the system.

## Specialist Recommendations

### Approach
(From specialist consultation — architectural advice, patterns to follow)
- [recommendation 1]
- [recommendation 2]

### Domain-Specific Constraints
(From domain specialist config, if a domain plugin is installed)
- [constraint 1]
- [constraint 2]

### Known Pitfalls
- [pitfall 1 — how to avoid]
- [pitfall 2 — how to avoid]

## Implementation Plan
1. Step 1
2. Step 2
3. Step 3

## API Contract
```
// Endpoint, request/response schemas
```

## Database Changes
```sql
-- Schema changes
```

## Security Considerations
- Authentication:
- Authorization:
- Data validation:
- Input sanitization:

## Testing Strategy

### Unit Tests
| Component | What to Test | Framework |
|-----------|-------------|-----------|
| [component] | [behavior] | [jest/vitest/pytest/go test] |

### Integration Tests
| Boundary | What to Test | Setup Required |
|----------|-------------|---------------|
| [API/DB/service] | [interaction] | [test DB, mock server, etc.] |

### Domain-Specific Tests (if domain plugin defines additional test types)
| Subject | Scenarios | Notes |
|---------|----------|-------|
| [domain-specific subject] | [scenarios] | [notes] |

### E2E Tests
| Flow | Steps | Expected Result |
|------|-------|----------------|
| [flow] | [steps] | [outcome] |

### TDD Workflow
1. Write tests for each component BEFORE implementation
2. Run tests — confirm they FAIL (RED)
3. Implement minimal code to pass (GREEN)
4. Refactor (IMPROVE)
5. Verify coverage >= 80%

## Rollback Plan
How to revert if something goes wrong.

## Dependencies
- External services:
- Internal modules:
- Specialist agents for development: [list]

---
*Created: {{date}}*
