---
name: cadence-sync
description: Sync vault structure — ensure existing project matches current cadence conventions. Use when the vault structure might be outdated or incomplete.
---

# Sync Vault Structure

Sync the vault structure for an existing project to match the latest conventions. Argument: project name or auto-detect from AGENTS.md.

## Steps

1. Find vault path from AGENTS.md under `## Obsidian Project`
2. If not found, tell user to run `/skill:cadence-init` first

### Scan the vault against expected structure:

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
├── Learning/Index.md
├── Learning/Integrations/
├── Learning/Patterns/
├── Learning/Writeups/
├── Research/
├── Notes/Decisions/
├── Notes/Daily/
├── Notes/Retros/
└── Archive/
```

For each item:
- Missing → create with standard template
- Exists → skip (never overwrite)

### Check shared `_Knowledge/` structure

- Missing → create with subdirectories and `Index.md`
- Exists → skip

### Check repo side
- `CHANGELOG.md` — create if missing
- Verify AGENTS.md has `## Obsidian Project` section

### Report

List everything created, confirm what already existed.
