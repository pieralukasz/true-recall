import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TrueRecallClient } from "../client.js";

export function registerRagTools(
	server: McpServer,
	client: TrueRecallClient,
): void {
	server.registerTool(
		"search_knowledge",
		{
			description:
				"Semantic search over the user's notes and flashcards. Returns ranked chunks with content, source info, and FSRS mastery data for flashcards. Use this to find relevant context before discussing any topic with the user. Pro subscription required.",
			inputSchema: {
				query: z
					.string()
					.describe(
						"Search query — what topic or concept to find in the user's knowledge base",
					),
				topK: z
					.number()
					.optional()
					.default(20)
					.describe("Number of results to return (default 20)"),
				sourceType: z
					.enum(["note", "flashcard", "all"])
					.optional()
					.default("all")
					.describe(
						"Filter by source type: 'note', 'flashcard', or 'all' (default)",
					),
				sourceIds: z
					.array(z.string())
					.optional()
					.describe(
						"Optional list of source IDs (file paths for notes, card IDs for flashcards) to restrict search scope. Use to search within specific notes.",
					),
			},
		},
		async (params) => {
			const data = await client.post("/rag/search", {
				query: params.query,
				topK: params.topK,
				sourceType: params.sourceType,
				sourceIds: params.sourceIds,
			});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"index_knowledge",
		{
			description:
				"Trigger a full reindex of the knowledge base. Indexes all vault notes and flashcards, computes embeddings for new/changed content. Pro subscription required.",
			inputSchema: {},
		},
		async () => {
			const data = await client.post("/rag/index", {});
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);

	server.registerTool(
		"get_knowledge_status",
		{
			description:
				"Get knowledge base index status: total chunks, embedded chunks, source counts, and last indexed timestamp. Pro subscription required.",
		},
		async () => {
			const data = await client.get("/rag/status");
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(data, null, 2) },
				],
			};
		},
	);
}
