---
description: Merge the current feature branch into main and run the full release pipeline
---

Merge the current feature branch into main and run the full release pipeline.

## Prerequisites

- Current branch must NOT be `main`, `pre-release`, or `release`.
- Working tree must be clean (no uncommitted changes).

## Steps

1. **Check preconditions.**
   - Verify current branch is a feature/fix/refactor branch (not main, pre-release, or release).
   - Verify working tree is clean. If dirty, stop and ask the user to commit or stash.
   - Run `git fetch origin` to ensure we have the latest remote state.

2. **Show merge preview.**
   - Run `git log --oneline main..HEAD` to show commits that will be merged.
   - Ask: **"These commits will be merged into main. Continue?"**

3. **Run full quality gate** (same as /verify): typecheck, lint, tests, build. Stop if anything fails.

4. **Merge into main.**
   - `git checkout main`
   - `git pull origin main`
   - `git merge <feature-branch> --no-ff` — use a merge commit to preserve branch history.
   - `git push origin main`

5. **Run pre-release checklist.**
   - Run test coverage: `bun vitest run --coverage` — report coverage summary.
   - Build CLI: `bun run cli:build` — verify CLI binary compiles.
   - Run `bun run changelog:preview` and `git log --oneline <last-tag>..HEAD` to show what changed.

6. **Promote to pre-release.**
   - `git checkout pre-release`
   - `git pull origin pre-release`
   - `git merge main --no-ff`
   - `git push origin pre-release`

7. **Promote to release.**
   - `git checkout release`
   - `git pull origin release`
   - `git merge pre-release --no-ff`
   - `git push origin release`

8. **Present summary:**
   - Quality gate: pass/fail
   - Coverage: percentage
   - CLI build: pass/fail
   - Changes included: categorized list
   - Branches merged: feature → main → pre-release → release

9. **Release.** Tell the user: "All branches are up to date. Ready to tag and create the GitHub Release?" If yes, invoke the release-tagger agent.

## Rules

- Stop and ask at every checkpoint (step 2, after quality gate, before each promotion).
- If any step fails, stop immediately — do not continue the pipeline.
- Never force-push.
- After the release is done, switch back to `main`.
- Never add Claude co-authorship footer to merge commits.
