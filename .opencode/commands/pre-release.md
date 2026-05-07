---
description: Run the full pre-release checklist before invoking the release-tagger agent
---

Run the full pre-release checklist before invoking the release-tagger agent.

## Steps

1. **Verify branch.** Ensure you're on `main` and it's up to date with `origin/main`.
2. **Run full quality gate** (same as /verify): typecheck, lint, tests, build. Stop if anything fails.
3. **Run test coverage.** `bun vitest run --coverage` — report coverage summary.
4. **Build CLI.** `bun run cli:build` — verify the CLI binary compiles.
5. **Changelog preview.** Run `bun run changelog:preview` and `git log --oneline <last-tag>..HEAD` to show what's changed.
6. **Present summary:**
   - Quality gate: pass/fail
   - Coverage: percentage
   - CLI build: pass/fail
   - Changes since last release: categorized list
7. **Ask:** "Everything looks good. Ready to start the release?" If yes, tell the user to invoke the release-tagger agent.
