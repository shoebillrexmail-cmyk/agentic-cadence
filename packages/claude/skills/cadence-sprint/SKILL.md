---
description: Pull refined stories into sprint, or start/archive a sprint
---

Manage the sprint. Argument: "$ARGUMENTS"

**If "start" or "new":**
1. Find the project's vault path from the repo's CLAUDE.md
2. Archive the current `Sprint/Board.md` to `Archive/Sprint-YYYY-MM-DD.md`
3. Create a fresh `Sprint/Board.md` with empty columns (Ready, In Progress, In Review, Done)
4. Read `Backlog/Product-Backlog.md` and list all "Refined" items
5. Ask the user which items to pull into the new sprint
6. Move selected items to "Ready" on the Sprint Board
7. Report the sprint plan with total story points

**If "pull" or specific story names:**
1. Read `Backlog/Product-Backlog.md` — find items in "Refined"
2. Move the specified stories (or ask user to pick) to `Sprint/Board.md` under "Ready"
3. Update each story's **Status** to `Ready`

**If "retro":**
1. Read `Sprint/Board.md` — summarize what was Done, what's still In Progress
2. Create `Notes/Retros/YYYY-MM-DD.md` with sections: What went well, What didn't, Action items
3. Ask the user to fill in their observations

**If "status" or no argument:**
1. Read `Sprint/Board.md` and report items per column
2. Calculate velocity: total points Done vs total points in sprint
