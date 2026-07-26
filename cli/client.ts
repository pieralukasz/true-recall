/**
 * The CLI and the MCP server talk to the same local HTTP API with the same
 * client. The implementation lives in mcp-server/client.ts (both processes
 * run under Bun); this re-export keeps the two from drifting apart again.
 */
export { TrueRecallClient } from "../mcp-server/client.js";
