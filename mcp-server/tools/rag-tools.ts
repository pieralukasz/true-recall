import { z } from "zod";
import { get, postParams, type ToolDef } from "./_register.js";

export const ragTools: ToolDef[] = [
	postParams(
		"search_knowledge",
		"Semantic search over the user's notes and flashcards. Returns ranked chunks with content, source info, source note paths, and FSRS mastery data. Supports time filtering and grouped output. Pro subscription required.",
		"/rag/search",
		{
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
					"Optional list of source IDs (file paths for notes, card IDs for flashcards) to restrict search scope.",
				),
			since: z
				.string()
				.optional()
				.describe(
					'Only return results modified after this time. Relative durations like "7d", "24h", "30m" or ISO dates like "2026-01-01".',
				),
			groupBySource: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					"Group results by source note. Flashcards from the same note are merged into one group.",
				),
		},
	),

	postParams(
		"index_knowledge",
		"Trigger a full reindex of the knowledge base. Indexes all vault notes and flashcards, computes embeddings for new/changed content. Pro subscription required.",
		"/rag/index",
		{
			force: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					"Clear all existing chunks and re-embed everything from scratch",
				),
		},
	),

	get(
		"get_knowledge_status",
		"Get knowledge base index status: total chunks, embedded chunks, source counts, and last indexed timestamp. Pro subscription required.",
		"/rag/status",
	),
];
