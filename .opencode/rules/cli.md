## CLI Subtree

This subtree is for the standalone `true-recall` CLI in `cli/`.

### Responsibilities

- User-facing command parsing
- Command registry and help output
- Thin adapters around True Recall capabilities

### Rules

- Keep command modules focused and composable
- Prefer sharing behavior with the main application model instead of reimplementing business logic in the CLI layer
- When adding commands, keep naming aligned with existing files under `cli/commands`
