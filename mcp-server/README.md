# True Recall MCP server

The server talks to the desktop-only Local API exposed by the Obsidian plugin.
Enable it under **Settings → True Recall → Integrations → Local API**, then copy
the generated token and start the MCP process with:

```sh
TRUE_RECALL_TOKEN="<token from Obsidian>" bun mcp-server/index.ts
```

Use `TRUE_RECALL_PORT` as well when the configured port is not `27182`. The API
listens only on `127.0.0.1`, requires authentication for every request, and does
not allow raw SQL unless that separate setting is enabled.
