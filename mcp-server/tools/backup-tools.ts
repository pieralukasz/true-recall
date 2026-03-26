import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TrueRecallClient } from "../client.js";

export function registerBackupTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.tool(
		"create_backup",
		"Create a compressed backup of the True Recall database. Backups are stored in .true-recall/backups/.",
		{},
		async () => {
			const data = await client.post("/backups/create", {});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.tool(
		"list_backups",
		"List all available database backups with dates and sizes.",
		{},
		async () => {
			const data = await client.get("/backups");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.tool(
		"check_integrity",
		"Run a database integrity check. Reports orphaned cards (no parent note), orphaned notes (no note type), and orphaned review logs (no parent card).",
		{},
		async () => {
			const data = await client.get("/integrity");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);
}
