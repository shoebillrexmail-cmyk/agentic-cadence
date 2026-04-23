---
name: agile-sprint
description: Manage sprint lifecycle — start new sprint, pull stories from backlog, or run a retro. Use when managing sprints, starting new ones, or reviewing sprint progress.
---

# Sprint Management

Argument: `start` | `pull <story names>` | `retro` | `status`

## "start" or "new"
1. Find vault path from AGENTS.md
2. Archive current `Sprint/Board.md` to `Archive/Sprint-YYYY-MM-DD.md`
3. Create fresh `Sprint/Board.md` with empty columns
4. Read `Backlog/Product-Backlog.md`, list all "Refined" items
5. Ask user which to pull into the sprint
6. Move selected items to "Ready" on Sprint Board
7. Report sprint plan with total story points

## "pull" or specific story names
1. Read `Backlog/Product-Backlog.md` — find "Refined" items
2. Move specified stories (or ask user to pick) to `Sprint/Board.md` under "Ready"
3. Update each story's **Status** to `Ready`

## "retro"
1. Read `Sprint/Board.md` — summarize Done, still In Progress
2. Create `Notes/Retros/YYYY-MM-DD.md` with:
   - What went well
   - What didn't
   - Action items
3. Ask user to fill in observations

## "status" or no argument
1. Read `Sprint/Board.md` — report items per column
2. Calculate velocity: total points Done vs total in sprint
