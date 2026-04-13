c# true-recall

This repository inherits the shared project baseline from `/Users/lukaszpiera/Projects/AGENTS.md`.

## Scope

- True Recall is an Obsidian plugin monorepo centered on spaced repetition and FSRS workflows.
- Treat repository-local `CLAUDE.md` and `.claude/rules/` as the primary project-specific extension of the shared baseline.
- Use subtree `CLAUDE.md` files for package-specific work in `packages/core`, `packages/obsidian`, `cli`, and `mcp-server`.

## Tooling

- Package manager: `bun`
- Workspace layout: `packages/*`
- Main commands:
  - `bun run dev`
  - `bun run build`
  - `bun run test`
  - `bun run test:coverage`
  - `bun run biome`
  - `bun run changelog`
  - `bun run perf:benchmark`

## Working Style

- Read `CLAUDE.md` first for current repo architecture, verification flow, release rules, and cross-cutting constraints.
- Follow the repository scripts instead of falling back to generic Obsidian plugin sample commands.
- Keep monorepo boundaries clear and prefer package-local changes over broad root-level edits unless the task truly spans packages.
