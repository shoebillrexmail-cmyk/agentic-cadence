---
name: agile-spike
description: Create and run a time-boxed research spike. Use when the user needs to investigate something, explore options, or do research before implementation.
---

# Research Spike

Create a research spike. Argument: the question to investigate.

## Steps

1. Find the vault path from AGENTS.md under `## Obsidian Project`
2. Generate a kebab-case topic name
3. Create `Research/SPIKE-<topic>.md`:

```markdown
# Spike: <Topic>

**Timebox**: (ask user, default 2 hours)
**Story**: (link if related)
**Status**: In Progress

## Question
<What do we need to learn>

## Approach
<How we'll investigate>

## Findings
<Fill in as research progresses>

## Recommendation
<Fill in after findings>

## Decision
- [ ] Decision made and documented
```

4. Conduct the research using available tools
5. Fill in Findings and Recommendation sections
6. Update Status to "Complete"
7. If linked to a story, update the story's notes with a link to the spike
