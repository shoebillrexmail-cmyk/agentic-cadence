---
description: Extract learnings from a completed story — generate educational writeups, patterns, and integration guides in the Obsidian vault
---

After a story is completed, extract what was learned and write it up. Learnings are classified as **cross-cutting** (shared across all projects in `_Knowledge/`) or **project-specific** (kept in the project's `Learning/` folder).

This skill is triggered automatically by `/cadence:done` after a story moves to Done, or manually via `/cadence:learn`.

## Arguments

- `$ARGUMENTS` — Story name (e.g. `STORY-auth-login`). If empty, detect from branch name.
- `--skip` — Skip learning extraction (for trivial changes)

## Step 1: Gather Context

1. Find the vault path from `CLAUDE.md` under `## Obsidian Project`
2. Determine the story from branch name or argument
3. Read the story file — extract specialist context, testing strategy, acceptance criteria
4. Read linked specs
5. Gather the change context:
   - `git diff develop...HEAD --stat` — scope of changes
   - `git log develop..HEAD --oneline` — commit history (tells the story of development)
   - Review findings (if `/cadence:review` ran) — what was caught and fixed
   - Specialist feedback captured in the story
6. Read existing sources to check for related prior learnings:
   - `C:\Obsidian_Vaults\_Knowledge\Index.md` — shared knowledge base
   - Project's `Learning/Index.md` — project-specific learnings

## Step 2: Assess What Was Learned

Analyze the gathered context and classify learnings into categories:

### Category Detection

| Signal | Category | Output |
|--------|----------|--------|
| Story involved a technology/service not previously used in the project | **Integration Guide** | `GUIDE-<name>.md` |
| Review found bugs that reveal a reusable anti-pattern | **Pattern** | `PATTERN-<name>.md` |
| A concrete mistake with a specific fix that others must avoid | **Gotcha** | `GOTCHA-<name>.md` |
| Story solved a complex problem with a non-obvious approach | **Writeup** | `WRITEUP-<name>.md` |
| Specialist agent provided guidance that was key to success | **Writeup** or **Pattern** | Depends on depth |
| Story was routine with no novel learnings | **Skip** | No output (note in story: "No new learnings") |

### Cross-Cutting vs Project-Specific Classification

After identifying a learning, classify WHERE it belongs:

| Criterion | Cross-cutting (`_Knowledge/`) | Project-specific (`Learning/`) |
|-----------|------------------------------|-------------------------------|
| **Applies to other projects?** | Yes — any project using this tech/pattern would benefit | No — only relevant to this project's architecture |
| **Domain-general?** | Yes — tied to a technology, language, or framework | No — tied to this project's specific design decisions |
| **Would another team hit this?** | Yes — it's a common trap or useful pattern | No — it's about this codebase's internals |
| **Examples** | "Never pass signer on OPNet frontend", "React useEffect stale closure gotcha", "Always simulate before sendTransaction" | "Our auth middleware uses X pattern", "The staking page layout follows Y convention" |

**Rule of thumb**: If you have to name the project to explain why it matters, it's project-specific. If you can explain it in terms of the technology alone, it's cross-cutting.

### Novelty Check

Before creating a learning, check BOTH locations for duplicates:

1. **Check `_Knowledge/`** — grep for similar entries by name, domain, and description
   - If a similar entry exists → **update** it (add new example, increment occurrences, update `last_verified`)
2. **Check project `Learning/`** — grep for similar entries
   - If a similar entry exists → **update** it instead of creating a duplicate
3. If genuinely new → create in the appropriate location

A story can produce multiple learnings (e.g., one cross-cutting gotcha + one project-specific writeup).

## Step 3: Generate Learnings

All learning documents use **frontmatter** for structured metadata:

```yaml
---
type: gotcha | pattern | guide | writeup
domain: [opnet, react, typescript, testing, ...]
severity: critical | high | medium | low
source_project: <project-name>
source_story: STORY-<name>
date_created: YYYY-MM-DD
last_verified: YYYY-MM-DD
status: active | deprecated | superseded
superseded_by: (link if replaced)
---
```

### Gotcha (`_Knowledge/Gotchas/GOTCHA-<name>.md`)

**When**: A concrete mistake was made (or nearly made) that has a specific, actionable fix. The "don't do X because Y" format.

**Destination**: Almost always cross-cutting — gotchas are by nature things any project could hit.

```markdown
---
type: gotcha
domain: [<domains>]
severity: <severity>
source_project: <project>
source_story: STORY-<name>
date_created: YYYY-MM-DD
last_verified: YYYY-MM-DD
status: active
superseded_by:
---

# GOTCHA: <Short Descriptive Name>

## The Problem
What goes wrong if you don't know this? Concrete description.

## The Wrong Way
```<language>
// Code that demonstrates the mistake
```

## The Fix
```<language>
// Code that demonstrates the correct approach
```

## How to Detect
How to spot this in code — grep patterns, code smells, warning signs.

## Context
- Found by: [review agent / manual testing / production bug / specialist consultation]
- Source story: [[<project>/Backlog/Stories/STORY-<name>]]
- Finding: [description of the review finding or bug]

## Related
- [[GOTCHA-related]] (if any)
```

### Pattern (`PATTERN-<name>.md`)

**When**: A review finding, a bug, or a specialist warning revealed a reusable pattern or anti-pattern.

**Destination**: Cross-cutting if it applies to the technology generally. Project-specific if it's about this project's conventions.

- Cross-cutting → `_Knowledge/Patterns/PATTERN-<name>.md`
- Project-specific → `Learning/Patterns/PATTERN-<name>.md`

```markdown
---
type: pattern
domain: [<domains>]
severity: <severity>
source_project: <project>
source_story: STORY-<name>
date_created: YYYY-MM-DD
last_verified: YYYY-MM-DD
status: active
superseded_by:
---

# Pattern: <Short Descriptive Name>

**Type**: Anti-pattern | Best Practice | Gotcha
**Severity**: Critical | High | Medium | Low
**Domain**: [domain list]
**Occurrences**: 1
**First seen**: [[STORY-<name>]] (YYYY-MM-DD)

## The Problem
What goes wrong if you don't know this? Concrete description.

## The Wrong Way
```<language>
// Code that demonstrates the mistake
```

## The Right Way
```<language>
// Code that demonstrates the correct approach
```

## Why It Matters
Explanation of the consequences — what breaks, what's the impact?

## How We Found It
- Found by: [review agent / manual testing / production bug / specialist consultation]
- Story: [[STORY-<name>]]
- Finding: [description of the review finding or bug]

## Related Patterns
- [[PATTERN-<related>]] (if any)

---
*Occurrences: STORY-<name>*
```

### Integration Guide (`GUIDE-<name>.md`)

**When**: The story involved connecting to a new API, using a new library, integrating a new service, or implementing a new protocol for the first time.

**Destination**: Cross-cutting if the guide applies to any project using this technology. Project-specific if it's about this project's specific integration setup.

- Cross-cutting → `_Knowledge/Guides/GUIDE-<name>.md`
- Project-specific → `Learning/Integrations/GUIDE-<name>.md`

```markdown
---
type: guide
domain: [<domains>]
severity: medium
source_project: <project>
source_story: STORY-<name>
date_created: YYYY-MM-DD
last_verified: YYYY-MM-DD
status: active
superseded_by:
---

# Integration Guide: <Technology/Service Name>

**First used in**: [[STORY-<name>]]
**Last updated**: YYYY-MM-DD
**Confidence**: Low | Medium | High (based on how battle-tested)

## What Is It?
Brief explanation of the technology/service and why we use it.

## How It Works
Step-by-step guide to the integration:
1. Setup / Installation
2. Configuration
3. Basic usage pattern
4. Our specific implementation

## Code Examples

### Basic Pattern
```<language>
// Annotated code showing the standard usage pattern
```

### Our Implementation
```<language>
// How we actually use it in this project, with file references
```

## Gotchas and Pitfalls
- [gotcha 1 — how we discovered it, how to avoid]
- [gotcha 2]

## Testing This Integration
- How to write tests for this integration
- Mocking strategies
- Integration test setup

## Related
- [[STORY-<name>]] — story where this was first implemented
- [[SPEC-<name>]] — relevant spec
- [external docs link] — official documentation

---
*Contributors: STORY-<name>*
```

### Writeup (`WRITEUP-<name>.md`)

**When**: The story involved a complex problem, a non-obvious solution, or a significant architectural decision that others (or future-you) would benefit from understanding deeply.

**Destination**: Cross-cutting if the approach generalizes beyond this project. Project-specific if it's about this project's specific architecture.

- Cross-cutting → `_Knowledge/Writeups/WRITEUP-<name>.md`
- Project-specific → `Learning/Writeups/WRITEUP-<name>.md`

```markdown
---
type: writeup
domain: [<domains>]
severity: medium
source_project: <project>
source_story: STORY-<name>
date_created: YYYY-MM-DD
last_verified: YYYY-MM-DD
status: active
superseded_by:
---

# Writeup: <Descriptive Title>

**Story**: [[STORY-<name>]]
**Date**: YYYY-MM-DD
**Domain**: [e.g. Frontend Architecture, API Design, DevOps, or domain plugin name]
**Difficulty**: Beginner | Intermediate | Advanced

## Context
What were we trying to build? What was the business need?

## The Challenge
What made this hard? What wasn't obvious?

## Approach
How did we think about the problem? What options did we consider?

### Option A: [approach name]
- Pros: ...
- Cons: ...

### Option B: [approach name] (chosen)
- Pros: ...
- Cons: ...
- Why we chose this: ...

## Implementation
Walk through the key parts of the implementation:

### Step 1: [phase name]
```<language>
// Key code with annotations explaining WHY, not just WHAT
```

### Step 2: [phase name]
...

## What We Learned
Key takeaways — the "aha moments":
1. [learning 1]
2. [learning 2]
3. [learning 3]

## Mistakes We Made
What went wrong during development and how we fixed it:
- [mistake 1] → [fix and lesson]
- [mistake 2] → [fix and lesson]

## If We Did It Again
What would we do differently with hindsight?

## Related
- [[STORY-<name>]] — the story
- [[GUIDE-<name>]] — integration guide (if applicable)
- [[PATTERN-<name>]] — patterns discovered (if applicable)
- [[SPEC-<name>]] — the spec

---
*Author: Claude + [user], from STORY-<name>*
```

## Step 4: Update Indexes

### Cross-cutting entries → update `_Knowledge/Index.md`

Add the entry under the appropriate domain and severity heading:

```markdown
## <Domain>

### <Severity>
- [GOTCHA-<name>](Gotchas/GOTCHA-<name>.md) — one-line summary
- [PATTERN-<name>](Patterns/PATTERN-<name>.md) — one-line summary
- [GUIDE-<name>](Guides/GUIDE-<name>.md) — one-line summary
- [WRITEUP-<name>](Writeups/WRITEUP-<name>.md) — one-line summary
```

If the entry's domain doesn't have a section yet, create one with Critical/High/Medium subheadings.

### Project-specific entries → update `Learning/Index.md`

Update the project's `Learning/Index.md` with the new entries in the existing table format:

```markdown
## Integration Guides
| Guide | Technology | Confidence | Stories |
|-------|-----------|------------|---------|
| [[GUIDE-<name>]] | [tech] | [Low/Med/High] | [[STORY-<name>]] |

## Patterns
| Pattern | Type | Severity | Domain | Occurrences |
|---------|------|----------|--------|-------------|
| [[PATTERN-<name>]] | [Anti-pattern/Best Practice/Gotcha] | [sev] | [domain] | [N] |

## Writeups
| Writeup | Domain | Difficulty | Date |
|---------|--------|------------|------|
| [[WRITEUP-<name>]] | [domain] | [level] | YYYY-MM-DD |
```

## Step 5: Link Back to Story

Add a `## Learnings` section to the completed story file:

```markdown
## Learnings

### Cross-cutting (in _Knowledge/)
- [[_Knowledge/Gotchas/GOTCHA-<name>]] — [brief description]
- [[_Knowledge/Patterns/PATTERN-<name>]] — [brief description]

### Project-specific (in Learning/)
- [[Learning/Integrations/GUIDE-<name>]] — [brief description]
- [[Learning/Writeups/WRITEUP-<name>]] — [brief description]
```

If all learnings are in one location, omit the subheadings.

## Step 6: Report to User

Present the generated learnings:

```
## Learnings from STORY-<name>

Generated {N} learning documents:

### Cross-cutting (_Knowledge/ — shared across all projects)
- GOTCHA-<name>: [title] — [one-line summary]
- PATTERN-<name>: [title] — [one-line summary]

### Project-specific (Learning/)
- GUIDE-<name>: [title] — [one-line summary]
- WRITEUP-<name>: [title] — [one-line summary]

Cross-cutting entries are in C:\Obsidian_Vaults\_Knowledge\.
Project entries are in your project's Learning/ folder.
```

If no learnings were generated (routine story), report: "No new learnings from this story — all patterns were already documented."

## Updating Existing Learnings

When a learning already exists for a topic:

**Integration Guides**: Add the new story's experience:
- Update "Last updated" date and `last_verified` in frontmatter
- Add new gotchas/pitfalls if discovered
- Increase "Confidence" level if appropriate (more usage = more confidence)
- Add story to "Contributors" list

**Patterns**: Increment occurrence count:
- Add new story to "Occurrences" list
- Update `last_verified` in frontmatter
- If the pattern was seen 3+ times, flag it: "This is a recurring pattern — consider adding a linter rule or pre-commit check"
- Update code examples if the new occurrence has a better illustration

**Gotchas**: Update with new context:
- Update `last_verified` in frontmatter
- Add new examples or detection methods if discovered
- If the gotcha has evolved (e.g., framework changed the API), update the fix

**Promoting project-specific to cross-cutting**: If a learning was initially project-specific but has now been encountered in a second project:
1. Move the file from `Learning/<type>/` to `_Knowledge/<type>/`
2. Update `source_project` to list both projects
3. Remove from project `Learning/Index.md`, add to `_Knowledge/Index.md`
4. Update wiki-links in both story files

## Notes

- Learning extraction is non-blocking — if it fails, the story still completes
- Users can run `/cadence:learn` manually on any completed story
- Writeups should be educational in tone — written for someone encountering this for the first time
- Code examples should be annotated with WHY comments, not just WHAT
- When updating existing learnings, never remove content — only add
- The `_Knowledge/` folder is shared across ALL projects — entries there are global
- The project `Learning/` folder remains for project-specific architecture decisions and conventions
- If a learning exists in both `_Knowledge/` and a project `Learning/`, the `_Knowledge/` version is authoritative
