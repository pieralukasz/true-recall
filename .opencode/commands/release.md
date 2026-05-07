---
description: Run the full release pipeline (quality gate, promotion, tag, GitHub Release)
---

Run the full release pipeline from main: quality gate, branch promotion, tag, and GitHub Release.

## Prerequisites

- Must be on `main` with a clean working tree.
- `main` must be up to date with `origin/main`.

## Steps

1. **Check preconditions.**
   - Verify current branch is `main`.
   - Verify working tree is clean. If dirty, stop and ask the user to commit or stash.
   - `git fetch origin` and verify `main` is up to date with `origin/main`.

2. **Run full quality gate** (same as /verify): typecheck, lint, tests, build. Stop if anything fails.

3. **Pre-release checks.**
   - Run test coverage: `bun vitest run --coverage` — report coverage summary.
   - Build CLI: `bun run cli:build` — verify CLI binary compiles.
   - Run `bun run changelog:preview` and `git log --oneline <last-tag>..HEAD` to show what changed.

4. **Promote to pre-release.**
   - `git checkout pre-release`
   - `git pull origin pre-release`
   - `git merge main --no-ff`
   - `git push origin pre-release`

5. **Promote to release.**
   - `git checkout release`
   - `git pull origin release`
   - `git merge pre-release --no-ff`
   - `git push origin release`

6. **Switch back to main.**
   - `git checkout main`

7. **Present summary:**
   - Quality gate: pass/fail
   - Coverage: percentage
   - CLI build: pass/fail
   - Changes included: categorized list
   - Branches promoted: main → pre-release → release

8. **Tag and release.** Ask: "All branches are up to date. Ready to tag and create the GitHub Release?" If yes, invoke the release-tagger agent.

## Rules

- If any step fails, stop immediately — do not continue.
- Never force-push.
- Never add Claude co-authorship footer to merge commits.
