---
title: Fast Commit
read_only: true
type: command
---

Create a new commit quickly without confirmation.

This command uses the same logic as the commit command but automatically selects the first suggested commit message without asking for confirmation.

1. Generate 3 commit message suggestions following the same format as the commit command
2. Automatically use the first suggestion without asking the user
3. Immediately run git commit -m with the first message

All other behaviors remain the same as the commit command (format, package names, staged files only).

Do NOT add Claude co-authorship footer to commits.
