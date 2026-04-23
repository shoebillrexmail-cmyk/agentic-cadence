---
name: agile-learn
description: Extract learnings from a completed story — generate gotchas, patterns, guides, and writeups in the Obsidian vault. Use after completing a story to capture knowledge.
---

# Learning Extraction

After a story is completed, extract what was learned. Learnings are classified as **cross-cutting** (`_Knowledge/`) or **project-specific** (`Learning/`).

## Arguments
- Story name (e.g. `STORY-auth-login`). If empty, detect from branch name.
- `--skip` — Skip learning extraction (for trivial changes)

## Step 1: Gather Context

1. Find vault path from AGENTS.md
2. Determine story from branch name or argument
3. Read story file — specialist context, testing strategy, acceptance criteria
4. Read linked specs
5. Gather change context:
   - `git diff develop...HEAD --stat`
   - `git log develop..HEAD --oneline`
   - Review findings (if review ran)
6. Read existing: `_Knowledge/Index.md` and `Learning/Index.md`

## Step 2: Assess What Was Learned

| Signal | Category | Output |
|--------|----------|--------|
| New technology/service used | **Integration Guide** | `GUIDE-<name>.md` |
| Review found reusable anti-pattern | **Pattern** | `PATTERN-<name>.md` |
| Concrete mistake with specific fix | **Gotcha** | `GOTCHA-<name>.md` |
| Complex problem, non-obvious solution | **Writeup** | `WRITEUP-<name>.md` |
| Routine change, no novel learnings | **Skip** | No output |

### Cross-cutting vs Project-specific

| Cross-cutting (`_Knowledge/`) | Project-specific (`Learning/`) |
|------------------------------|-------------------------------|
| Any project using this tech would benefit | Only relevant to this project |
| Tied to technology, language, framework | Tied to this project's design decisions |

**Rule of thumb**: If you have to name the project, it's project-specific.

### Deduplication
Before creating, check BOTH `_Knowledge/` and `Learning/` for similar entries. Update existing instead of duplicating.

## Step 3: Generate Learning Documents

All use frontmatter:

```yaml
---
type: gotcha | pattern | guide | writeup
domain: [<domains>]
severity: critical | high | medium | low
source_project: <project>
source_story: STORY-<name>
date_created: YYYY-MM-DD
last_verified: YYYY-MM-DD
status: active
---
```

### Gotcha (`_Knowledge/Gotchas/GOTCHA-<name>.md`)
Sections: The Problem, The Wrong Way (code), The Fix (code), How to Detect, Context

### Pattern (`PATTERN-<name>.md`)
Cross-cutting → `_Knowledge/Patterns/`, Project-specific → `Learning/Patterns/`
Sections: The Problem, The Wrong Way, The Right Way, Why It Matters

### Guide (`GUIDE-<name>.md`)
Cross-cutting → `_Knowledge/Guides/`, Project-specific → `Learning/Integrations/`
Sections: What Is It?, How It Works, Code Examples, Gotchas and Pitfalls, Testing

### Writeup (`WRITEUP-<name>.md`)
Cross-cutting → `_Knowledge/Writeups/`, Project-specific → `Learning/Writeups/`
Sections: Context, The Challenge, Approach, Implementation, What We Learned

## Step 4: Update Indexes

Update `_Knowledge/Index.md` and/or `Learning/Index.md` with new entries.

## Step 5: Link Back to Story

Add `## Learnings` section to the completed story file.

## Step 6: Report

```
## Learnings from STORY-<name>
Generated {N} learning documents:

### Cross-cutting (_Knowledge/)
- GOTCHA-<name>: [summary]
- PATTERN-<name>: [summary]

### Project-specific (Learning/)
- GUIDE-<name>: [summary]
```
