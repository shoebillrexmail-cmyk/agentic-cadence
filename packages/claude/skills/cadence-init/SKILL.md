---
description: Initialize project workflow for a project — create vault structure, CLAUDE.md config
---

Initialize the workflow for a project. Argument: "$ARGUMENTS" is the project name.

If no argument, ask for the project name.

1. **Create vault structure** at `<Obsidian_Vaults>/<ProjectName>/`:
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
   ├── Archive/
   ```

2. **Create Sprint/Board.md** (Kanban format):
   ```
   ---
   kanban-plugin: basic
   ---
   ## Ready
   ## In Progress
   ## In Review
   ## Done
   ```

3. **Create Backlog/Product-Backlog.md** (Kanban format):
   ```
   ---
   kanban-plugin: basic
   ---
   ## Icebox
   ## Needs Refinement
   ## Refined
   ```

4. **Create Roadmap.md** with placeholder phases

5. **Update the repo's CLAUDE.md** (or create it) with:
   ```markdown
   ## Obsidian Project
   - Vault project: <ProjectName>
   - Sprint Board: <Obsidian_Vaults>/<ProjectName>/Sprint/Board.md
   - Product Backlog: <Obsidian_Vaults>/<ProjectName>/Backlog/Product-Backlog.md
   - Specs: <Obsidian_Vaults>/<ProjectName>/Specs/
   - Research: <Obsidian_Vaults>/<ProjectName>/Research/
   ```

6. **Ensure shared `_Knowledge/` structure exists** at `<Obsidian_Vaults>/_Knowledge/`:
   - If the `_Knowledge/` directory doesn't exist, create it with:
     ```
     _Knowledge/
     ├── Index.md
     ├── Gotchas/
     ├── Patterns/
     ├── Guides/
     └── Writeups/
     ```
   - Use the `Knowledge-Index-template.md` for `Index.md`
   - If `_Knowledge/` already exists, skip (never overwrite existing content)
   - This is vault-level (not project-level) — shared across all projects

7. **Update Dashboard** at `<Obsidian_Vaults>/_Dashboard.md` with the new project

8. Report: "Workflow initialized for <ProjectName>. Open your vault in Obsidian to see the boards."
