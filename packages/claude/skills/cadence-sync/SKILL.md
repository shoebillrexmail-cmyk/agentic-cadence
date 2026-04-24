---
description: Sync vault structure — ensure existing project matches current cadence conventions
---

Sync the vault structure for an existing project to match the latest cadence conventions. Argument: "$ARGUMENTS"

1. Find the project's vault path from the repo's CLAUDE.md under `## Obsidian Project`
2. If no vault path found, tell the user to run `/cadence:init` first

**Scan the vault against the expected structure:**

```
<ProjectName>/
├── Roadmap.md
├── Sprint/
│   └── Board.md
├── Backlog/
│   ├── Product-Backlog.md
│   ├── Epics/
│   └── Stories/
├── Specs/
│   ├── Features/
│   ├── Technical/
│   └── API/
├── Learning/
│   ├── Index.md
│   ├── Integrations/
│   ├── Patterns/
│   └── Writeups/
├── Research/
├── Notes/
│   ├── Decisions/
│   ├── Daily/
│   └── Retros/
└── Archive/
```

**For each item:**
- If directory is missing → create it
- If file is missing → create it with the standard template (see below)
- If file/directory exists → skip (never overwrite existing content)

**Standard templates for missing files:**

`Sprint/Board.md`:
```
---
kanban-plugin: basic
---

## Ready

## In Progress

## In Review

## Done
```

`Backlog/Product-Backlog.md`:
```
---
kanban-plugin: basic
---

## Icebox

## Needs Refinement

## Refined
```

`Learning/Index.md`:
```
# Learning Index

Catalog of learnings from this project. Updated automatically by `/cadence:done`.

## Integrations

## Patterns

## Writeups
```

`Roadmap.md`:
```
# Roadmap

## Phase 1
- [ ] TBD
```

**Also check the shared `_Knowledge/` structure** at `<Obsidian_Vaults>/_Knowledge/`:

```
_Knowledge/
├── Index.md
├── Gotchas/
├── Patterns/
├── Guides/
└── Writeups/
```

- If `_Knowledge/` directory is missing → create it with subdirectories and `Index.md`
- If subdirectories are missing → create them
- If `Index.md` is missing → create from `Knowledge-Index-template.md`
- If everything exists → skip (never overwrite existing content)

**Also check the repo side:**
- `CHANGELOG.md` — if missing, create with:
  ```
  # Changelog

  All notable changes to this project will be documented in this file.
  Format based on [Keep a Changelog](https://keepachangelog.com/).

  ## [Unreleased]
  ```
- Verify `CLAUDE.md` has the `## Obsidian Project` section with correct paths

**Report:**
List everything that was created, and confirm what already existed. Example:
```
Vault sync complete for <ProjectName>:
  Created: Learning/Integrations/, Learning/Writeups/, CHANGELOG.md
  Already exists: Sprint/Board.md, Backlog/, Specs/, Archive/ (and 12 others)
```
