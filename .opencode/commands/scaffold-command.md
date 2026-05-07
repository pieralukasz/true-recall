---
description: Scaffold a new CLI command with a matching MCP server tool
---

Scaffold a new CLI command with a matching MCP server tool.

## Input

The user provides the command name and a brief description of what it does.

## Steps

1. **Explore existing patterns.** Read one existing CLI command from `cli/commands/` and its matching MCP tool from `mcp-server/tools/` to understand the current conventions (imports, types, registration pattern).

2. **Create CLI command.** Write a new file in `cli/commands/<name>.ts`:
   - Follow the same structure as existing commands (command definition, handler, options)
   - Register it in `cli/registry.ts`

3. **Create MCP tool.** Write a new file in `mcp-server/tools/<name>.ts`:
   - Mirror the CLI command's functionality
   - Follow the MCP tool pattern (tool definition, input schema, handler)
   - Register it in the MCP server's tool list

4. **Add types if needed.** If the command introduces new domain types, add them in `packages/core/src/types/`.

5. **Build CLI.** Run `bun run cli:build` to verify the command compiles.

6. **Test.** Run the new CLI command with `--help` to verify it's registered correctly.

7. **Summary.** List all created/modified files.
