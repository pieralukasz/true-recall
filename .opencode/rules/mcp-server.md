## MCP Server Subtree

This subtree is for the MCP server in `mcp-server/`.

### Responsibilities

- Registering tool definitions
- Translating MCP inputs into True Recall operations
- Returning stable, tool-friendly responses

### Rules

- Keep tool registration centralized through the existing registration flow
- Add new tools in the appropriate `tools/*-tools.ts` file instead of one giant catch-all file
- Align MCP tool naming and descriptions with existing CLI capabilities where possible
