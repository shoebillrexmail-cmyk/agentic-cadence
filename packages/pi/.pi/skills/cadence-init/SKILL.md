---
name: cadence-init
description: Initialize project workflow for a project — create vault structure, AGENTS.md config. Use when setting up a new project with workflow.
---

# Initialize Cadence

Argument: project name (if not provided, ask the user).

## Step 1: Create vault structure

Create the folder structure at `<Obsidian_Vaults>/<ProjectName>/`:

```
<ProjectName>/
├── Roadmap.md
├── Sprint/Board.md
├── Backlog/Product-Backlog.md
├── Backlog/Epics/
├── Backlog/Stories/
├── Specs/Features/
├── Specs/Technical/
├── Specs/API/
├── Research/
├── Learning/
│   ├── Index.md
│   ├── Integrations/
│   ├── Patterns/
│   └── Writeups/
├── Notes/Decisions/
├── Notes/Daily/
├── Notes/Retros/
└── Archive/
```

## Step 2: Create Sprint/Board.md

```
---
kanban-plugin: basic
---
## Ready
## In Progress
## In Review
## Done
```

## Step 3: Create Backlog/Product-Backlog.md

```
---
kanban-plugin: basic
---
## Icebox
## Needs Refinement
## Refined
```

## Step 4: Create Roadmap.md

```markdown
# Roadmap
## Phase 1
- [ ] TBD
```

## Step 5: Update the repo's AGENTS.md

Add (or create) the Obsidian Project section:

```markdown
## Obsidian Project
- Vault project: <ProjectName>
- Sprint Board: <Obsidian_Vaults>/<ProjectName>/Sprint/Board.md
- Product Backlog: <Obsidian_Vaults>/<ProjectName>/Backlog/Product-Backlog.md
- Specs: <Obsidian_Vaults>/<ProjectName>/Specs/
- Research: <Obsidian_Vaults>/<ProjectName>/Research/
```

## Step 6: Create shared `_Knowledge/` structure

If `<Obsidian_Vaults>/_Knowledge/` doesn't exist, create it with:
- `Index.md`
- `Gotchas/`
- `Patterns/`
- `Guides/`
- `Writeups/`

If it already exists, skip (never overwrite).

## Step 7: Report

"Workflow initialized for <ProjectName>. Open your vault in Obsidian to see the boards."
