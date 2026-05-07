## Monorepo Architecture

True Recall is an Obsidian plugin monorepo with shared domain logic and auxiliary interfaces.

### Top-level areas

- `packages/core`
  Platform-agnostic domain logic, persistence, AI integration, FSRS logic, metrics, RAG, and validation
- `packages/obsidian`
  Obsidian plugin shell, UI, data layer, commands, views, settings, and adapters
- `cli`
  Standalone CLI for Claude Code integration and operational workflows
- `mcp-server`
  MCP server exposing True Recall capabilities as tools
- `docs`
  Product and operational documentation
- `assets`
  Marketing and README screenshots

### Actual package boundaries

- `@true-recall/core`
  Shared domain package. No Obsidian runtime dependencies
- `@true-recall/obsidian`
  Plugin package that depends on `@true-recall/core`

### Dependency rules

1. `@true-recall/core` must stay platform-agnostic
2. `@true-recall/obsidian` may depend on `@true-recall/core`
3. `cli` and `mcp-server` should act as adapters around existing application capabilities, not reimplement core business logic
4. Cross-package imports should respect workspace boundaries and existing aliases

### Important correction

- There is no `packages/ui` workspace in the current repo
- Shared UI currently lives under `packages/obsidian/src/components`, `src/preact`, and feature-specific UI folders
