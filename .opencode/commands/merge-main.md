---
description: Merge the latest main branch into the current branch
---

Merge the latest `main` branch into the current branch.

## Steps

1. Run `git fetch origin main` to get the latest remote main.
2. Run `git merge origin/main` into the current branch.
3. If the merge succeeds cleanly, report success with a short summary of what was merged (commit count).
4. If there are merge conflicts:
   - List all conflicted files.
   - For each conflicted file, read the conflict markers and resolve them intelligently — prefer the current branch's intent while incorporating main's changes.
   - After resolving, stage the files and complete the merge commit.
   - Summarize what was resolved.
5. If the working tree has uncommitted changes before merging, warn the user and ask whether to stash first or abort.
