import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerQueryTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"query_sql",
		{
			description:
				"Execute a read-only SQL SELECT query against the True Recall database. Only SELECT queries are allowed. Use get_schema first to understand the database structure.",
			inputSchema: {
				sql: z
					.string()
					.describe("SQL SELECT query to execute"),
			},
		},
		async (params) => {
			const data = await client.post("/query", { sql: params.sql });
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);

	server.registerTool(
		"get_schema",
		{
			description:
				"Get the database schema with table names, columns, types, row counts, and FSRS-specific annotations (what card states mean, how to identify problem cards, etc.)",
		},
		async () => {
			const data = await client.get("/schema");
			return {
				content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
			};
		},
	);
}
