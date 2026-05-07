## Obsidian Package

This subtree is for the Obsidian plugin in `packages/obsidian`.

### Responsibilities

- Plugin entry and lifecycle
- Commands, views, modals, and settings UI
- Editor integrations and widgets
- Obsidian adapters and API server
- Reactive data access and UI state

### Rules

- Prefer changes inside the relevant feature slice under `src/features`, `src/views`, `src/modals`, or `src/editor`
- Treat `src/store` as UI state, not as an alternative data source for domain data
- Keep plugin glue and adapter code near `src/plugin`, `src/adapters`, and `src/services`
- If a change touches SQL-backed UI data, check whether it should flow through the DataLayer
