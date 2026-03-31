import type { CommandDef } from "../registry.js";
import { get, post, postParams } from "../registry.js";

const C = "Knowledge Base";

export const ragCommands: CommandDef[] = [
	postParams(
		"search_knowledge",
		"Semantic search over the user's notes and flashcards. Returns ranked chunks with FSRS mastery data. Pro required.",
		C,
		"/rag/search",
		{
			query: {
				type: "string",
				description: "Search query — topic or concept to find",
				required: true,
			},
			topK: {
				type: "number",
				description: "Number of results to return (default 20)",
				default: 20,
			},
			sourceType: {
				type: "string",
				description: "Filter by source type",
				enum: ["note", "flashcard", "all"],
				default: "all",
			},
			sourceIds: {
				type: "json",
				description: "JSON array of source IDs to restrict search scope",
			},
		},
	),

	post(
		"index_knowledge",
		"Trigger a full reindex of the knowledge base. Pro required.",
		C,
		"/rag/index",
	),

	get(
		"get_knowledge_status",
		"Get knowledge base index status: total chunks, embedded chunks, source counts. Pro required.",
		C,
		"/rag/status",
	),
];
