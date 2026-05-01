---
description: Run the full quality gate (typecheck, lint, tests, build)
---

Run the full quality gate: typecheck, lint, tests, and build.

## Steps

1. Run `tsc -noEmit`. If it fails, list errors grouped by file.
2. Run `biome check packages/`. If it fails, list fixable vs manual issues. Offer to run `biome check --write packages/` for auto-fixable ones.
3. Run `bun vitest run`. If any tests fail, summarize which suites failed.
4. Run `bun esbuild.config.mjs production` to verify the build succeeds.
5. Report a final pass/fail summary:
   - Typecheck: pass/fail (N errors)
   - Lint: pass/fail (N issues)
   - Tests: pass/fail (N failed / N total)
   - Build: pass/fail
6. If everything passes, say it's safe to push.
7. If anything fails, offer to fix the issues.
