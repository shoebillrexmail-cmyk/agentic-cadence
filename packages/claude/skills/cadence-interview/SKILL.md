---
description: Run a Socratic interview to clarify vague requirements before story creation. Optionally run just the Ontology Gate as a quality check on an existing story.
---

Conduct a structured Socratic interview to clarify a feature idea before creating a story. The argument "$ARGUMENTS" describes the feature or includes flags.

## Arguments

- `--gate-only` — Skip interview, just run the Ontology Gate (4 questions) on an existing story
- `--max-rounds N` (default: 5) — Maximum interview rounds before forcing closure
- (default) — Run full interview on the described feature

## Mode 1: Full Interview

### Step 1: Analyze the Request

Read the user's feature description and determine:

1. **Ambiguity level**: Is this vague enough to need an interview?
   - Vague (1-2 sentences, unclear scope) → Proceed with interview
   - Clear (detailed spec, well-defined boundaries) → Suggest skipping to `cadence-story` directly
   - Multiple features mentioned → Note all tracks for breadth tracking

2. **Identify ambiguity tracks**: Extract independent concerns, deliverables, or questions from the request.

### Step 2: Conduct Socratic Interview (2-5 rounds)

Cycle through four perspectives based on what's most needed each round:

#### Round 1: Scope & Essence (Ontologist + Socratic Interviewer)
- **"What IS this, really?"** — Strip away surface details
- **"What's the core problem you're trying to solve?"** — Find the actual need
- List all ambiguity tracks found in the request

Ask ONE focused question. Wait for the user's answer before continuing.

#### Rounds 2-4: Deepen & Challenge (rotate perspectives)

**Ontologist** (root cause analysis):
- **"Is this the root cause or a symptom of something deeper?"**
- **"If we solve this, does the underlying issue remain?"**
- **"What must exist before this can work?"** (prerequisites)
- **"What are we assuming that might not be true?"** (hidden assumptions)

**Breadth Keeper** (prevent collapse):
- After 2 rounds on one track: **"You also mentioned [X] — is that still relevant? What about [Y]?"**
- Track unresolved tracks explicitly
- Never let one track dominate more than 3 consecutive rounds

**Simplifier** (challenge scope):
- **"What's the simplest version of this that could work?"**
- **"What can we cut without losing the core value?"**
- **"Are we solving the problem or building a framework?"**

**Socratic Interviewer** (reduce ambiguity):
- Target the biggest remaining source of ambiguity
- Build on previous responses
- Be specific and actionable

Each round: Ask ONE question. Wait for answer. Then continue.

#### Round 5 (or earlier if clarity reached): Closure Check (Seed Closer)

Before closing, verify:
- [ ] Scope is explicit and bounded
- [ ] Non-goals are stated
- [ ] Expected outputs are defined
- [ ] Verification expectations are clear
- [ ] No material blocker remains unresolved

If any are missing, ask one more targeted question. Otherwise:

**Closure question**: "I have a clear picture: [summarize scope]. Out of scope: [non-goals]. We'll verify success by: [verification]. Should I proceed to create the story, or is anything still unclear?"

### Step 3: Run Ontology Gate

Before finishing, run the mandatory 4-question quality gate:

| # | Question | Check |
|---|----------|-------|
| 1 | **Essence**: What IS this, really? | Story describes the core problem |
| 2 | **Root Cause**: Is this the root cause or a symptom? | Addressing the actual root cause |
| 3 | **Prerequisites**: What must exist first? | Dependencies identified |
| 4 | **Hidden Assumptions**: What are we assuming? | Assumptions documented |

**Gate outcomes**:
- **All pass** → Proceed to story summary
- **Root cause = symptom** → Tell user: "This appears to be a symptom of [X]. Should we create a story for the root cause instead, or treat the symptom intentionally?"
- **Missing prerequisites** → "This depends on [X] which doesn't exist yet. Create a prerequisite story first?"
- **Wrong assumptions** → "This assumes [X] but [Y]. Should we rewrite with corrected assumptions?"

### Step 4: Present Interview Summary

Present the structured result:

```markdown
## Interview Summary for: [Feature Name]

### Clarified Scope
[What we're building, in specific terms]

### Root Problem (vs Symptom)
[The actual problem — confirmed root cause]

### Non-Goals
[Explicitly out of scope]

### Hidden Assumptions Surfaced
[What we assumed and confirmed/rejected]

### Simplification Applied
[What was cut or simplified from original ask]

### Prerequisites
[What must exist first, if anything]

### Verification Expectations
[How success will be judged]
```

Then ask: "Ready to create the story? Say `yes` to run `/cadence:story` with this clarified scope, or refine further."

---

## Mode 2: Gate Only (`--gate-only`)

When `--gate-only` is passed, skip the interview and just run the Ontology Gate on an existing story.

### Step 1: Find the Story

1. Determine the story name from `$ARGUMENTS` (after removing `--gate-only`)
2. If no name given, find the current story from the branch name
3. Read the story file from `Backlog/Stories/STORY-<name>.md`

### Step 2: Run the 4 Questions

Analyze the story against the Ontology Gate:

1. **Essence**: Does the story describe the core problem, or surface details?
2. **Root Cause**: Is this addressing a root cause or treating a symptom?
3. **Prerequisites**: Are all dependencies present or accounted for?
4. **Hidden Assumptions**: Are implicit assumptions documented or confirmed?

### Step 3: Report

```markdown
## Ontology Gate: STORY-<name>

| Question | Result | Notes |
|----------|--------|-------|
| Essence | ✅ PASS / ❌ FAIL | [what this is really about] |
| Root Cause | ✅ PASS / ❌ FAIL | [root cause or symptom identified] |
| Prerequisites | ✅ PASS / ❌ FAIL | [dependencies listed or confirmed] |
| Hidden Assumptions | ✅ PASS / ❌ FAIL | [assumptions documented] |

**Overall**: PASS / NEEDS REVISION
```

If any question fails, suggest specific fixes to the story.

---

## Integration with cadence-story

The interview skill is designed to run before `cadence-story`. Two usage patterns:

1. **Explicit**: User runs `/cadence:interview "build a login system"` → gets clarified scope → then runs `/cadence:story` with the result
2. **Auto-triggered**: `cadence-story` can auto-trigger the interview when the feature description is ambiguous (single sentence, unclear scope). This is controlled by the `--interview` flag on `cadence-story`.
