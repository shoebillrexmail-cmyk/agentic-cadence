---
name: agile-release
description: Cut a release — version bump, changelog, tag, merge to master, GitHub Release. Use when the user wants to ship a release, tag a version, or merge develop to master.
---

# Cut Release

Cut a release from develop to master. The argument describes the release intent (e.g., "v1.2.0", "quick", "status", "abort", or empty to infer).

## Step 0: Load Cadence Config

Before anything else, load per-project overrides:

1. Find `AGENTS.md` at repo root
2. Shell: `node shared/scripts/parse-cadence-config.mjs <path-to-AGENTS.md>`
3. Parse JSON: `{ config, warnings, effective }`
4. Log warnings + applied config to user
5. Release skill has no configurable keys today — this step exists for consistency and in case `agents.disable` comes to matter (e.g., disabling a future release-time auditor role).

Missing parser / config file → proceed with defaults.

## Step 1: Context Discovery

1. Find the project's vault path from `AGENTS.md` under `## Obsidian Project`
2. Read the current branch — ensure you are on `develop` (or `master`; reject feature/hotfix branches)

## Step 2: Determine what's shipping

1. `git fetch origin && git log origin/master..origin/develop --oneline` — list commits since last release
2. Read `CHANGELOG.md` — check the `[Unreleased]` section (create the file if it doesn't exist)
3. Check the latest git tag: `git describe --tags --abbrev=0 2>/dev/null || echo "no tags yet"`
4. Summarize what's included (features, fixes, breaking changes)

## Step 3: Determine version

- If argument includes a version (e.g., `v1.2.0`), use that
- Otherwise, suggest based on semantic versioning:
  - Any breaking changes in the commit log → MAJOR bump
  - Any `feat:` commits → MINOR bump
  - Only `fix:`, `chore:`, `docs:`, `refactor:` → PATCH bump
- Ask the user to confirm: "Release as vX.Y.Z?"

## Step 4: Create release artifact in vault

1. Create `Archive/Release-vX.Y.Z.md` with:
   - Date, sprint reference, branch name
   - Stories included (read from Sprint Board "Done" column)
   - Changes (from `CHANGELOG.md [Unreleased]`)
   - Release checklist (all items unchecked)

## Step 5: Execute the release

### If argument includes "quick" or the user confirmed quick release:
1. Bump version in source files (`package.json`, `version.ts`, or equivalent — search for the current version string)
2. Update `CHANGELOG.md` — rename `[Unreleased]` to `[vX.Y.Z] - YYYY-MM-DD`, add empty `[Unreleased]` section above
3. Commit on develop: `chore(release): prepare vX.Y.Z`
4. Push develop
5. **Ask user for final confirmation** before merging to master
6. Merge to master:
   ```
   git checkout master && git pull origin master
   git merge --no-ff develop -m "release: vX.Y.Z"
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin master --tags
   ```
7. Switch back to develop: `git checkout develop`
8. Create GitHub Release: `gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes`
9. Check off items in `Archive/Release-vX.Y.Z.md`

### Otherwise (standard release with stabilization branch):
1. Cut the release branch:
   ```
   git checkout develop && git pull origin develop
   git checkout -b release/vX.Y.Z
   ```
2. Bump version in source files
3. Update `CHANGELOG.md` — rename `[Unreleased]` to `[vX.Y.Z] - YYYY-MM-DD`, add empty `[Unreleased]` section above
4. Commit: `chore(release): prepare vX.Y.Z`
5. Push: `git push -u origin release/vX.Y.Z`
6. Run full test suite — if tests fail, fix on the release branch
7. Report status: "Release branch `release/vX.Y.Z` is ready. Run tests, apply last-minute fixes, then tell me to ship it."
8. **When user says "ship it" or "merge":**
   a. **Ask for final confirmation**: "This will merge release/vX.Y.Z to master and tag vX.Y.Z. Proceed?"
   b. Merge to master:
      ```
      git checkout master && git pull origin master
      git merge --no-ff release/vX.Y.Z -m "release: vX.Y.Z"
      git tag -a vX.Y.Z -m "Release vX.Y.Z"
      git push origin master --tags
      ```
   c. Back-merge to develop:
      ```
      git checkout develop && git pull origin develop
      git merge --no-ff release/vX.Y.Z -m "chore: merge release/vX.Y.Z back to develop"
      git push origin develop
      ```
   d. Delete release branch:
      ```
      git branch -d release/vX.Y.Z
      git push origin --delete release/vX.Y.Z
      ```
   e. Create GitHub Release:
      ```
      gh release create vX.Y.Z --title "vX.Y.Z" --notes-file CHANGELOG_EXCERPT.md
      ```
      (Extract the vX.Y.Z section from `CHANGELOG.md` for the notes)
   f. Check off all items in `Archive/Release-vX.Y.Z.md`
   g. Report: "Release vX.Y.Z shipped. GitHub Release created. Release branch cleaned up."

## "status" mode

1. Check if a `release/*` branch exists: `git branch -a | grep release/`
2. If yes: show commits on the release branch, remaining checklist items from `Archive/Release-vX.Y.Z.md`
3. If no: show what would ship (commits on develop since last tag)

## "abort" mode

1. Delete the release branch locally and remotely
2. Remove the `Archive/Release-vX.Y.Z.md` file
3. Report: "Release aborted. No changes were merged to master."

---

## Notes

- This skill mirrors the Claude `cadence-release` skill exactly. The only adaptation for Pi is reading `AGENTS.md` instead of `CLAUDE.md` and adding the standard Step 0 config loader.
- Pi has no subagent runtime, so any future release-time review delegation is inlined rather than Task-dispatched.
