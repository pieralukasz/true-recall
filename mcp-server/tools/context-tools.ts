import {
	customNoArgs,
	errorResult,
	get,
	jsonResult,
	type ToolDef,
} from "./_register.js";

export const contextTools: ToolDef[] = [
	customNoArgs(
		"get_status",
		"Check if the True Recall plugin is running and the database is ready",
		async (client) => {
			try {
				return jsonResult(await client.get("/status"));
			} catch {
				return errorResult(
					"True Recall plugin is not running or the local API is not enabled. Enable it in Settings → Advanced → Local API.",
				);
			}
		},
	),

	get(
		"get_full_context",
		"START HERE — always call this first before any other True Recall tool. Returns everything you need to understand the user's current state: which Obsidian view is active (review, editor, browser, etc.), the current review card (if in a session), active note info, today's study stats, and due count. This single call replaces the need to call get_active_note, get_review_context, or get_status separately. Only use those specific tools if you need deeper detail after calling this one.",
		"/context",
	),

	get(
		"get_active_note",
		"Get the full markdown content of the currently open note in Obsidian, plus its associated flashcards. Use ONLY when you need the actual note text (e.g. to generate flashcards from it or analyze its content). For just knowing which note is open, use get_full_context instead — it's faster and includes note metadata without the full content.",
		"/active-note",
	),
];
