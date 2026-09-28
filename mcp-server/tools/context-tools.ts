import { customNoArgs, get, jsonResult, type ToolDef } from "./_register.js";

export const contextTools: ToolDef[] = [
	customNoArgs(
		"get_status",
		"Check that True Recall is reachable: returns running, dbReady and the vault name. Call it when another True Recall tool fails. On failure the error says which fix applies: a connection error means Obsidian is closed or Settings → True Recall → Integrations → Enable local API is off; HTTP 401 means TRUE_RECALL_TOKEN is missing or wrong. The user fixes these on their side, so report them instead of retrying.",
		async (client) => jsonResult(await client.get("/status")),
	),

	get(
		"get_full_context",
		"Returns the user's current True Recall state in one call: vault name, active Obsidian view, the active note (path, sourceUid, card counts by state), the review session (phase, current card including its answer, isAnswerRevealed, progress), today's study totals and the due count. Call it before other True Recall tools when the conversation doesn't already contain this state. It covers what get_status, get_review_context and get_active_note summarize; use those only for detail it omits, such as the note's markdown.",
		"/context",
	),

	get(
		"get_active_note",
		"Returns the note open in Obsidian: path, full markdown content, sourceUid, and every flashcard linked to it with its userComment. Use it when you need the note's text or want to check cards against it; get_full_context already has the path and card counts. A card's userComment is the user's own concern about that card, not source material. Fails with 404 when no markdown note is open.",
		"/active-note",
	),
];
