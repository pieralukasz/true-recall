# Git Stint Workflow

All file edits are intercepted by git-stint hooks and redirected to isolated
worktrees. One stint session = one branch = one PR.

## Session Naming

When creating a session, pick a short descriptive name that captures the task:
- Good: `fix-auth-refresh`, `add-user-search`, `refactor-db-queries`
- Bad: `session-1`, `changes`, `test`, `update`

The name becomes the branch (`stint/<name>`) and the PR title context.

## Session Lifecycle

- If the hook blocks a write, create a session: `git stint start <descriptive-name>`
- Any uncommitted files on main are automatically carried into the new session.
  Do NOT redo work that was already written — it is adopted into the worktree.
- All edits redirect to `.stint/<session>/` worktree.
- `git stint commit -m "msg"` to commit logical units of work.
- `git stint pr` to push and create PR.
- `git stint end` ONLY after ALL related work is done.

## Rules

- **NEVER end or delete a stint session you didn't create.** Other sessions
  belong to other conversations or agents. Only operate on your own session
  (the one auto-created by the hook for your edits). Use `git stint list` to
  see all sessions — leave others alone.
- Do NOT call `git stint end` until all changes are committed (code, tests,
  config updates, follow-up tasks). Premature `end` kills the session; the
  next edit auto-creates a NEW session, fragmenting work across multiple PRs.
- Sub-agents share the same session (same PPID). No special handling needed.
- Files outside the repo bypass hooks — edit freely.
- Gitignored files bypass hooks — edit freely.
- Directories listed under `shared_dirs` in `.stint.json` are symlinked into
  worktrees pointing to the main repo's real directories. They must never be
  staged or committed. The hooks auto-add them to the worktree's `.gitignore`.
