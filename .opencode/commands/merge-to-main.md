---
description: Merge the current feature branch into main
---

Merge the current feature branch into main.

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

5. **Clean up.**
   - Stay on `main` after the merge.
   - Report: merged commits count, branch name, and quality gate status.

## Rules

- Stop and ask at every checkpoint (step 2, after quality gate).
- If any step fails, stop immediately — do not continue.
- Never force-push.
- Never add Claude co-authorship footer to merge commits.
