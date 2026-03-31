import type { SessionConfig } from "@true-recall/core/types/session-config.types";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

interface StartSessionInput {
	mode?:
		| "all_due"
		| "current_note"
		| "weak_cards"
		| "created_today"
		| "overdue"
		| "custom";
	source_uid?: string;
	card_limit?: number;
	state_filter?: "due" | "learning" | "new" | "buried";
	overdue_only?: boolean;
	recently_failed?: boolean;
	cramming?: boolean;
}

export async function handleStartSession(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<StartSessionInput>(raw);
	const mode = body?.mode ?? "all_due";

	let config: SessionConfig;

	switch (mode) {
		case "current_note": {
			const file = ctx.plugin.app.workspace.getActiveFile();
			if (!file || file.extension !== "md") {
				sendError(res, 404, "No active markdown note");
				return;
			}
			const sourceUid = await ctx.plugin.flashcardManager
				.getFrontmatterService()
				.getSourceNoteUid(file.path);
			if (!sourceUid) {
				sendError(res, 404, "No flashcards found for active note");
				return;
			}
			config = { mode: "note", sourceUid };
			break;
		}

		case "created_today":
			config = { mode: "created_today" };
			break;

		case "weak_cards":
			config = { mode: "weak_cards" };
			break;

		case "overdue":
			config = { mode: "overdue" };
			break;

		case "custom":
			config = {
				mode: "custom",
				sourceUidFilter: body?.source_uid,
				cardLimit: body?.card_limit,
				stateFilter: body?.state_filter,
				overdueOnly: body?.overdue_only,
				recentlyFailed: body?.recently_failed,
				crammingMode: body?.cramming,
				ignoreDailyLimits: true,
			};
			break;

		default:
			config = { mode: "all_due" };
	}

	await ctx.plugin.startReview(config);
	sendOk(res, { started: true, mode });
}
