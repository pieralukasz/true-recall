---
description: Run a parallel multi-agent review on the current PR (5 specialists in parallel + synthesizer)
---

Run a parallel multi-agent review on the current PR: 5 specialists in parallel → synthesizer dedupes, ranks, and auto-fixes critical issues on isolated branches.

## Steps

1. **Gather PR context.** Run these in parallel:
   - `git rev-parse --abbrev-ref HEAD` — current branch
   - `git fetch origin main` then `git log --oneline main..HEAD` — commits in the PR
   - `git diff main...HEAD` — full diff (the three-dot form: base→HEAD, not base vs working tree)
   - `git diff --name-only main...HEAD` — changed file list
   - `gh pr view --json title,body,baseRefName 2>&1` — PR metadata if a PR exists; tolerate failure (branch may not have a PR yet)

   If the diff is empty, stop and tell the user there's nothing to review.

   If `baseRefName` from `gh pr view` differs from `main`, redo the diff commands against that base.

2. **Spawn the 5 reviewers in parallel.** Send a SINGLE message with 5 `task` tool calls. Each must target its matching subagent (via `subagent` parameter or `@review-*` mention):
   - `review-security`
   - `review-tests`
   - `review-performance`
   - `review-architecture`
   - `review-docs`

   Pass the same payload to each agent. Embed the actual content — do not paste raw multi-thousand-line diffs if they exceed ~3000 lines; in that case, embed the changed-file list + per-file unified diffs capped at 400 lines per file, and let the agent request a file read if it needs more.

   Payload template (fill in real values before sending):

   ```
   PR context

   Base branch: <base>
   Current branch: <head>
   Changed files:
   <list>

   Recent commits (one line each):
   <log>

   Full diff (base...HEAD):
   <diff>
   ```

3. **Collect the JSON blocks.** Each reviewer ends its response with exactly one fenced JSON block. Extract all 5 blocks. If any is malformed, keep the raw text and note it — the synthesizer handles partial input.

4. **Spawn the synthesizer.** Use the `task` tool targeting subagent `review-synthesizer`. Pass:
   - All 5 reviewer outputs verbatim (the full JSON blocks)
   - Base branch, current branch
   - Repo root (CWD)
   - Auto-fix policy: `critical` severity only; gate is `bun run test` + `bunx tsc --noEmit`; retry up to 3 attempts per finding; never push.

5. **Relay the synthesizer's report to the user as-is.** Do not summarize it away — the table and the follow-up list are the deliverable.

6. **After the report, ask one question:** whether to inspect any of the auto-fix branches, cherry-pick them into the PR branch, or discard them. Do not take that action until the user answers.

## Rules

- Reviewers run in PARALLEL. One message, five `task` tool calls. Sequential spawning defeats the purpose.
- Reviewers must NOT modify files. Only the synthesizer touches the repo.
- The synthesizer never pushes. Branches stay local until the user decides.
- If the working tree is dirty at step 1, pause and ask the user to commit or stash before continuing — auto-fix needs a clean base.
- If this is run outside a git repo or without an `origin/main`, stop with a helpful error.
- Never add Claude co-author footers to any commits the synthesizer creates.
