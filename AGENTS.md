# true-recall

Obsidian plugin monorepo for spaced-repetition / FSRS workflows.

## Tooling

- Package manager: `bun` (never `npm test` or `npm run`; always `bun run <script>`)
- Workspace layout: `packages/*` (`@true-recall/core`, `@true-recall/obsidian`), plus `cli/` and `mcp-server/`
- Common scripts: `bun run dev`, `bun run build`, `bun run test`, `bun run biome`, `bun run changelog`

## Working style

- Detailed project rules live in `.opencode/rules/*.md` and are auto-loaded via the `instructions` field in `opencode.json`.
- Custom slash-commands live in `.opencode/commands/`; reviewer agents and skill-derived subagents in `.opencode/agents/`.
- Lint and build run automatically via `.opencode/plugins/quality-hooks.ts` (`tool.execute.after` lints edited TS files; `session.idle` runs `bun run build`).
- Keep this file short — durable knowledge belongs in `.opencode/rules/`.

## Scope

- Repository is an Obsidian plugin monorepo centered on True Recall.
- Subtree concerns: `packages/core` (platform-agnostic domain), `packages/obsidian` (plugin shell + UI), `cli` (standalone binary), `mcp-server` (MCP tool surface).
- Each rule file under `.opencode/rules/` covers one slice — read the relevant slice before changing code in that area.
