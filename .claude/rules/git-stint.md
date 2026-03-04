# Git Stint Workflow (Opt-In)

Stint is available but **not active by default**. Edits go directly to main
unless the user explicitly requests stint isolation.

## When to Use Stint

Only use stint when the user explicitly says so, e.g.:
- "use stint for this"
- "start a stint session"
- "work in a worktree"
- "I want this on a separate branch"

## Starting a Session

```bash
git stint start <descriptive-name>
cd .stint/<descriptive-name>/
```

Pick a short descriptive name: `fix-auth-refresh`, `add-user-search`, `refactor-db-queries`.
The name becomes the branch (`stint/<name>`) and the PR title context.

## Session Lifecycle

1. `git stint start <name>` — create session + worktree
2. Work in `.stint/<name>/` directory
3. `git stint commit -m "msg"` — commit logical units
4. `git stint pr` — push and create PR
5. `git stint end` — ONLY after ALL work is done

## Rules

- **NEVER end or delete a stint session you didn't create.** Other sessions
  belong to other conversations or agents.
- Do NOT call `git stint end` until all changes are committed.
- Sub-agents share the same session (same PPID).
- Files outside the repo and gitignored files bypass hooks.
- Directories listed under `shared_dirs` in `.stint.json` are symlinked into
  worktrees and must never be staged or committed.
