---
description: Push the current branch and create a pull request
---

Push the current branch and create a pull request.

## Steps

1. Ask: **"Draft or ready for review?"** — default is draft.
2. Run `git status` and `git log main..HEAD` to understand what will be in the PR.
3. If there are uncommitted changes, ask whether to commit them first or leave them out.
4. Push the branch to origin with `git push -u origin HEAD`.
5. Create the PR using `gh pr create`:
   - Add `--draft` flag unless the user explicitly chose "ready for review".
   - Base branch is `main` unless specified otherwise.
   - Title: short, under 70 chars, reflecting the feature/fix.
   - Body: `## Summary` with 1-3 bullet points, then `## Test plan` with checklist.
6. Return the PR URL.

## Rules

- If the branch already has an open PR, show its URL and ask whether to update it instead.
- Never add Claude co-authorship footer.
