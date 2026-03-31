import type { CommandDef } from "../registry.js";
import { customNoArgs, get } from "../registry.js";

const C = "Context";

export const contextCommands: CommandDef[] = [
	customNoArgs(
		"get_status",
		"Check if the True Recall plugin is running and the database is ready",
		C,
		async (client) => {
			try {
				return await client.get("/status");
			} catch {
				throw new Error(
					"True Recall plugin is not running or the local API is not enabled. Enable it in Settings → Advanced → Local API.",
				);
			}
		},
	),

	get(
		"get_full_context",
		"Complete snapshot: active view, review session with current card, active note, today's stats, due count",
		C,
		"/context",
	),

	get(
		"get_active_note",
		"Get the currently open note: path, content, source_uid, and all linked flashcards",
		C,
		"/active-note",
	),
];
