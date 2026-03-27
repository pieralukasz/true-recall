import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
				"Get the project/deck hierarchy tree. Projects are Obsidian notes organized via 'parents' frontmatter into a tree structure. Each project groups related source notes and their flashcards.",
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
}
