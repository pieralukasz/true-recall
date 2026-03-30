import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerDashboardTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"get_dashboard",
		{
			description:
				"Get a full dashboard overview: total cards, due/new/learning/overdue counts, today's progress (studied, time, new vs review caps), streak, estimated study time, per-note breakdown with priority, and orphaned card stats.",
		},
		async () => {
			const data = await client.get("/dashboard");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"get_projects",
		{
			description:
				"Get the project/deck hierarchy tree with aggregate stats (total cards, due, new, learning, overdue counts per project). Returns summary without per-note member details. Use get_project for a detailed breakdown of a specific project.",
		},
		async () => {
			const data = await client.get("/projects");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"get_project",
		{
			description:
				"Get detailed stats for a single project including per-note member breakdown (name, path, due, new, learning, total cards, overdue days). Use get_projects first to discover project paths.",
			inputSchema: {
				path: z
					.string()
					.describe(
						"The project's vault-relative file path (e.g. 'Projects/Spanish.md'). Get this from the get_projects response.",
					),
			},
		},
		async (params) => {
			const data = await client.get(
				`/project?path=${encodeURIComponent(params.path)}`,
			);
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);
}
