---
description: Create and run a time-boxed research spike
---

Create a research spike. Argument: "$ARGUMENTS" describes the question to investigate.

1. Find the project's vault path from the repo's CLAUDE.md under `## Obsidian Project`
2. Generate a kebab-case topic name
3. Create `Research/SPIKE-<topic>.md`:

```markdown
# Spike: <Topic>

**Timebox**: (ask user, default 2 hours)
**Story**: (link if related to a story)
**Status**: In Progress

## Question
<What do we need to learn — derived from $ARGUMENTS>

## Approach
<How we'll investigate — search, prototype, read docs, etc.>

## Findings
<Fill in as research progresses>

## Recommendation
<Fill in after findings>

## Decision
- [ ] Decision made and documented
```

4. Conduct the research using web search, code search, and documentation
5. Fill in the Findings and Recommendation sections
6. Update Status to "Complete"
7. If linked to a story, update the story's notes with a link to the spike
