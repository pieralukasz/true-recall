import type { CommandDef } from "../registry.js";
import { get, post, postParams } from "../registry.js";

const C = "Knowledge Base";

export const ragCommands: CommandDef[] = [
	postParams(
		"search_knowledge",
		"Semantic search over the user's notes and flashcards. Returns ranked chunks with FSRS mastery data and source note paths. Supports time filtering and grouped output. Pro required.",
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
			since: {
				type: "string",
				description:
					'Only return results modified after this time. Supports relative durations (e.g. "7d", "24h", "30m") or ISO dates (e.g. "2026-01-01")',
			},
			groupBySource: {
				type: "boolean",
				description:
					"Group results by source note. Flashcards from the same note are merged into one group with the note path and all matching chunks",
				default: false,
			},
		},
	),

	postParams(
		"index_knowledge",
		"Trigger a full reindex of the knowledge base. Pro required.",
		C,
		"/rag/index",
		{
			force: {
				type: "boolean",
				description:
					"Clear all existing chunks and re-embed everything from scratch",
				default: false,
			},
		},
	),

	get(
		"get_knowledge_status",
		"Get knowledge base index status: total chunks, embedded chunks, source counts. Pro required.",
		C,
		"/rag/status",
	),
];
