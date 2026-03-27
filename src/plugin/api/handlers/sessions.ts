import type { IncomingMessage, ServerResponse } from "http";
import type { ApiContext } from "../api.types";
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
	req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<StartSessionInput>(raw);
	const mode = body?.mode ?? "all_due";

	switch (mode) {
		case "current_note": {
			const file = ctx.plugin.app.workspace.getActiveFile();
			if (!file || file.extension !== "md") {
				sendError(res, 404, "No active markdown note");
				return;
			}
			await ctx.plugin.reviewNoteFlashcards(file);
			sendOk(res, { started: true, mode, note: file.basename });
			return;
		}

		case "created_today": {
			await ctx.plugin.reviewTodaysCards();
			sendOk(res, { started: true, mode });
			return;
		}

		case "weak_cards": {
			await ctx.plugin.openReviewViewWithFilters({
				weakCardsOnly: true,
				ignoreDailyLimits: true,
				bypassScheduling: true,
			});
			sendOk(res, { started: true, mode });
			return;
		}

		case "overdue": {
			await ctx.plugin.openReviewViewWithFilters({
				overdueOnly: true,
				ignoreDailyLimits: true,
			});
			sendOk(res, { started: true, mode });
			return;
		}

		case "custom": {
			await ctx.plugin.openReviewViewWithFilters({
				sourceUidFilter: body?.source_uid,
				cardLimit: body?.card_limit,
				stateFilter: body?.state_filter,
				overdueOnly: body?.overdue_only,
				recentlyFailed: body?.recently_failed,
				crammingMode: body?.cramming,
				ignoreDailyLimits: true,
			});
			sendOk(res, { started: true, mode, filters: body });
			return;
		}

		default: {
			// "all_due" — standard review with daily limits
			await ctx.plugin.openReviewViewWithFilters({});
			sendOk(res, { started: true, mode: "all_due" });
		}
	}
}
