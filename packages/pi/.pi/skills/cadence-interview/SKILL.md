---
name: cadence-interview
description: Run a Socratic interview to clarify vague requirements before story creation. Use when the user describes a feature vaguely, says "I need X" without details, or explicitly wants to discuss a feature before creating a story.
---

# Socratic Interview for Story Clarification

Conduct a structured Socratic interview to clarify a feature idea.

Pi has no subagent runtime. The interview cycles through five role perspectives whose full prompts live in `.pi/prompts/shared-agents.md` (auto-generated from `shared/agents/`). This skill orchestrates those roles by referencing them by name; if deeper behavior is needed, consult the full role definition in shared-agents.md.

Roles used:
- `ontologist` — 4 fundamental questions (Essence / Root Cause / Prerequisites / Hidden Assumptions)
- `socratic-interviewer` — one targeted question per round
- `breadth-keeper` — tracks multiple concerns; prevents collapse
- `simplifier` — challenges scope; proposes cuts
- `seed-closer` — decides when to close

## Arguments
- `--gate-only` — Skip interview, run Ontology Gate on existing story only
- `--max-rounds N` (default: 5, overridable via Cadence Config `interview.max_rounds`) — Maximum interview rounds
- (default) — Run full interview

## Step 0: Load Cadence Config

Before anything else, load per-project overrides from `AGENTS.md`:

1. Find `AGENTS.md` at the repo root
2. Shell out: `node {baseDir}/parse-cadence-config.mjs <path-to-AGENTS.md>`
3. Parse JSON: `{ config, warnings, effective }`
4. Log warnings + applied config to user
5. Apply:
   - `effective["interview.max_rounds"]` — cap (the `--max-rounds` CLI flag wins if explicitly passed)
   - `effective["agents.disable"]` — when applying a role, if its name is in this list, skip with `Skipped disabled role: <name>` log

Missing parser / config file → proceed with defaults.

## Mode 1: Full Interview

### Step 1: Analyze Request

Read the feature description. Decide:
- **Vague** → proceed with interview
- **Clear** → suggest skipping to `/skill:cadence-story` directly
- **Multi-track** → note all tracks for breadth tracking

### Step 2: Round 1 — Framing

Run the `ontologist` role on the raw request (interview mode) — produce the 4-question verdict.
Run the `breadth-keeper` role — extract the initial track list.

Present a 2-3 sentence framing summary to the user.

### Step 3: Rounds 2-4 — Deepen & Challenge

Each round:
1. Pick the role most relevant given last-round signals:
   - Symptom / wrong assumption flagged → stay with `ontologist`
   - `breadth-keeper` said `SHIFT_TO_<track>` → shift to new track
   - Scope growing → run `simplifier`
   - Otherwise → `socratic-interviewer`
2. Apply that role's prompt format to produce ONE question.
3. Ask the user. Wait for answer.
4. Update round history.
5. End of round: re-run `breadth-keeper` (track status) + `seed-closer` (closure check, from round 3).

Stop when `seed-closer` returns `CLOSE` or `ESCALATE`.

### Step 4: Final Ontology Gate

Run `ontologist` in gate-only mode on the consolidated scope. Render the report table verbatim. Act on verdict:

- `PROCEED` → present summary
- `SPLIT` → "This is a symptom of [X]. Story for root cause instead?"
- `REWRITE` → rewrite scope with corrections, re-gate
- `BLOCK` → create prerequisite stories first

### Step 5: Present Summary

```
## Interview Summary: [Feature]

### Clarified Scope
[What we're building]

### Root Problem (vs Symptom)
[Confirmed root cause]

### Non-Goals
[Out of scope]

### Assumptions Surfaced
[Confirmed/rejected]

### Simplification
[What was cut]

### Verification
[How success is judged]
```

Ask: "Ready to create the story with `/skill:cadence-story`?"

---

## Mode 2: Gate Only (`--gate-only`)

Find the story (from argument or current branch), run the `ontologist` role in gate-only mode, render the 4-question report with PASS/FAIL and recommended fixes.

---

## Integration

- Runs before `/skill:cadence-story` for vague features
- `cadence-story` auto-triggers this skill with `--interview` flag
- Standalone: `/skill:cadence-interview "build a payment system"`
- Full role prompts: `.pi/prompts/shared-agents.md`
