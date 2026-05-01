---
description: Preview what would go in the next release changelog
---

Preview what would go in the next release changelog.

## Steps

1. Find the latest tag: `git describe --tags --abbrev=0`.
2. Show commits since that tag: `git log --oneline <tag>..HEAD`.
3. Run `bun run changelog:preview` for the auto-categorized view.
4. Write a polished, user-facing draft of the changelog:
   - Group into: **Features**, **Bug Fixes**, **Improvements** (only sections that have entries).
   - Rewrite developer commit messages into user-friendly descriptions.
   - Focus on what users will notice — skip pure internal refactoring unless it improves UX.
   - Keep it concise — 1-2 lines per item max.
5. Present the draft and ask if it looks right.
