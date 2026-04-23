---
description: Run a Socratic interview to clarify vague requirements before story creation. Optionally run just the Ontology Gate as a quality check on an existing story.
---

Conduct a structured Socratic interview to clarify a feature idea before creating a story. This skill orchestrates shared agents (`ontologist`, `socratic-interviewer`, `breadth-keeper`, `simplifier`, `seed-closer`) — one per role, each invoked via the Task tool.

The argument `"$ARGUMENTS"` describes the feature or includes flags.

## Arguments

- `--gate-only` — Skip interview, just run the Ontology Gate on an existing story (delegates to `ontologist` in gate-only mode)
- `--max-rounds N` (default: 5, overridable via Cadence Config `interview.max_rounds`) — Hard cap on interview rounds
- (default) — Run full interview on the described feature

## Step 0: Load Cadence Config

Before anything else, load per-project overrides:

1. Find the project context file path (`CLAUDE.md` at repo root)
2. Run via Bash: `node shared/scripts/parse-cadence-config.mjs <path-to-CLAUDE.md>`
3. Parse the JSON output: `{ config, warnings, effective }`
4. If `warnings` is non-empty: display `Cadence config warnings: <list>` to the user
5. If `config` is non-empty: display `Cadence config applied: <config>`
6. Use `effective` values downstream:
   - `effective["interview.max_rounds"]` — hard cap (the `--max-rounds` CLI flag wins if explicitly passed; otherwise `effective` applies)
   - `effective["agents.disable"]` — when about to Task-invoke an agent, if its name is in this list, skip and log `Skipped disabled agent: <name>` instead

If the parser script or context file is missing, proceed with all defaults — missing config never blocks the skill.

## Mode 1: Full Interview

### Step 1: Analyze the Request

Read the user's feature description. Classify:

- **Ambiguity level**: vague (1-2 sentences, unclear scope) → interview; clear (detailed spec) → suggest skipping to `/cadence:story` directly
- **Potential tracks**: if multiple deliverables or concerns appear, note them for breadth tracking

### Step 2: Round 1 — Framing

Launch TWO agents in parallel via the Task tool:

1. **Task → `ontologist`** in `interview` mode with the raw request. Expect: 4-question verdict (essence, root cause, prerequisites, hidden assumptions).
2. **Task → `breadth-keeper`** with the raw request and empty round history. Expect: initial track list with all tracks OPEN and a recommended starting track.

Present the user with a concise framing summary synthesized from both agents (don't dump the raw agent output — distill it into 2-3 sentences).

### Step 3: Rounds 2-4 — Deepen & Challenge

Each round does the following:

1. **Choose perspective** based on what's most needed:
   - If ontologist flagged a symptom/assumption issue last round → stay with ontology angle
   - If breadth-keeper recommends `SHIFT_TO_<track>` → shift focus
   - If scope is growing large → run simplifier
   - Otherwise → advance the Socratic thread
2. **Task → the chosen agent** with round history + the target ambiguity / track:
   - `socratic-interviewer` for a targeted ambiguity-reduction question
   - `ontologist` to re-run the 4-question check when framing feels wrong
   - `breadth-keeper` for a track-shift decision
   - `simplifier` for a scope-cut proposal
3. **Ask the user ONE question** drawn from the agent's output.
4. **Capture the answer** into the round history.
5. **Task → `breadth-keeper`** at end of round to update track status.
6. **Task → `seed-closer`** at end of round 3+ to check closure criteria.

Rules:

- Never ask multi-part questions. One concrete question per round.
- Never let one track consume more than 3 consecutive rounds without a breadth check.
- Stop the loop immediately if `seed-closer` returns `CLOSE` or `ESCALATE`.

### Step 4: Round 5 (or earlier on closure) — Close

If `seed-closer` returned `CLOSE`: proceed to Step 5.
If `seed-closer` returned `ESCALATE`: tell the user which criteria remain unmet and ask whether to accept the incomplete scope or abort.

### Step 5: Final Ontology Gate

**Task → `ontologist`** in `gate-only` mode with the consolidated scope. Expect: the 4-question verdict table + `PROCEED | SPLIT | REWRITE | BLOCK`.

Gate outcomes:
- `PROCEED` → Continue to Step 6
- `SPLIT` → "This appears to be a symptom of [X]. Should we create a root-cause story instead, or intentionally treat the symptom?"
- `REWRITE` → Rewrite scope with the corrections the ontologist listed, then re-gate
- `BLOCK` → Missing prerequisites — create prerequisite stories first

### Step 6: Present Interview Summary

```markdown
## Interview Summary for: [Feature Name]

### Clarified Scope
[What we're building, in specific terms]

### Root Problem (vs Symptom)
[The actual problem — confirmed root cause from ontologist]

### Non-Goals
[Explicitly out of scope]

### Hidden Assumptions Surfaced
[From ontologist + any contrarian pass if run]

### Simplification Applied
[From simplifier, if run]

### Prerequisites
[From ontologist gate]

### Verification Expectations
[How success will be judged]
```

Then ask: "Ready to create the story? Say `yes` to run `/cadence:story` with this clarified scope, or refine further."

---

## Mode 2: Gate Only (`--gate-only`)

Single delegation:

1. Determine the story name from `$ARGUMENTS` (after removing `--gate-only`).
2. If no name given, find the current story from the branch name (`feature/STORY-<name>`).
3. Read the story file from `Backlog/Stories/STORY-<name>.md`.
4. **Task → `ontologist`** in `gate-only` mode with the full story content as target.
5. Render the ontologist's report table verbatim to the user.
6. If any question FAILed, surface the specific fixes the ontologist recommended.

---

## Why this design

The role perspectives are NOT role-played inline. Each round dispatches to a dedicated shared agent via the Task tool so that:

- The agent definitions live in one place (`shared/agents/`, emitted to `packages/claude/agents/`)
- Changes to role behavior update every skill that uses them
- Agent outputs are structured (tables, verdicts) and machine-parseable across rounds
- Context isolation — the interviewer doesn't accumulate the full conversation, just what the orchestrator passes forward

## Integration with cadence-story

- **Explicit**: User runs `/cadence:interview "build a login system"` → gets clarified scope → then runs `/cadence:story` with the result
- **Auto-triggered**: `cadence-story` auto-triggers this skill when the description is ambiguous (via its `--interview` flag)
