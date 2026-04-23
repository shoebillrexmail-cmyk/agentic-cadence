---
name: agile-interview
description: Run a Socratic interview to clarify vague requirements before story creation. Use when the user describes a feature vaguely, says "I need X" without details, or explicitly wants to discuss a feature before creating a story.
---

# Socratic Interview for Story Clarification

Conduct a structured Socratic interview to clarify a feature idea. The argument describes the feature or includes flags.

## Arguments
- `--gate-only` — Skip interview, run Ontology Gate (4 questions) on existing story only
- `--max-rounds N` (default: 5) — Maximum interview rounds
- (default) — Run full interview

## Mode 1: Full Interview

### Step 1: Analyze Request

Read the feature description. Determine:
- **Ambiguity**: Vague → interview. Clear → suggest skipping to `/skill:agile-story`.
- **Tracks**: Extract independent concerns or deliverables for breadth tracking.

### Step 2: Socratic Interview (2-5 rounds)

Ask ONE question per round. Wait for the answer. Cycle through perspectives:

#### Round 1: Scope & Essence
- **"What IS this, really?"** — Strip away surface details
- **"What's the core problem?"** — Find the actual need
- List all ambiguity tracks

#### Rounds 2-4: Deepen & Challenge

**Ontologist** (pick as needed):
- "Is this the root cause or a symptom?"
- "What must exist before this can work?"
- "What are we assuming?"

**Breadth Keeper** (after 2 rounds on one track):
- "What about [other track you mentioned]?"
- "Any other concerns besides this?"

**Simplifier** (when scope seems large):
- "What's the simplest version that could work?"
- "What can we cut without losing core value?"

#### Round 5: Closure Check

Verify scope, non-goals, outputs, and verification are clear. If yes:

**"I have a clear picture: [scope]. Out of scope: [non-goals]. Proceed to create story?"**

### Step 3: Ontology Gate

Run the 4-question quality gate:

| Question | Check |
|----------|-------|
| **Essence**: What IS this? | Core problem described |
| **Root Cause**: Root cause or symptom? | Addressing actual cause |
| **Prerequisites**: What must exist first? | Dependencies identified |
| **Assumptions**: What are we assuming? | Assumptions documented |

Outcomes:
- **All pass** → Present summary
- **Symptom detected** → "This is a symptom of [X]. Story for root cause instead?"
- **Missing prerequisites** → "Depends on [X]. Create prerequisite story first?"
- **Wrong assumptions** → Rewrite with corrected assumptions

### Step 4: Present Summary

```
## Interview Summary: [Feature]

### Clarified Scope
[What we're building]

### Root Problem (vs Symptom)
[Confirmed root cause]

### Non-Goals
[Out of scope]

### Assumptions Surfaced
[Confirmed/rejected assumptions]

### Simplification
[What was cut]

### Verification
[How success is judged]
```

Ask: "Ready to create the story with `/skill:agile-story`?"

---

## Mode 2: Gate Only (`--gate-only`)

Find the story (from argument or current branch), run the 4 questions, report PASS/FAIL per question with suggestions.

---

## Integration

- Runs before `/skill:agile-story` for vague features
- `agile-story` auto-triggers interview with `--interview` flag
- Standalone: `/skill:agile-interview "build a payment system"`
