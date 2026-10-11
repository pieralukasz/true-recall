import { ValidationError } from "@true-recall/core/errors";
import { editDateTimestamp } from "@true-recall/core/helpers/edit-date";
import { CardEditHistoryActions } from "@true-recall/core/persistence/sqlite/modules/CardEditHistoryActions";
import type { NoteEditSource } from "@true-recall/core/types/note.types";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendError, sendOk } from "../api.types";

function history(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	cardId?: string,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}
	const params = new URL(req.url ?? "/", "http://localhost").searchParams;
	const date = (name: string) => {
		const value = params.get(name);
		if (value === null) return undefined;
		const timestamp = editDateTimestamp(value);
		if (timestamp === undefined)
			throw new ValidationError(
				"Expected a valid YYYY-MM-DD date or ISO datetime with explicit timezone",
			);
		return timestamp;
	};
	const editSource = params.get("edit_source") ?? undefined;
	if (
		editSource !== undefined &&
		!["manual", "ai", "system"].includes(editSource)
	)
		throw new ValidationError("Invalid edit source");
	const filters = {
		since: date("since"),
		until: date("until"),
		editSource: editSource as NoteEditSource | undefined,
		sourceUid: params.get("source_uid") ?? undefined,
		limit: params.has("limit") ? Number(params.get("limit")) : undefined,
		offset: params.has("offset") ? Number(params.get("offset")) : undefined,
	};
	const actions = new CardEditHistoryActions(
		ctx.plugin.cardStore.getSqliteDb(),
	);
	sendOk(
		res,
		cardId === undefined
			? actions.list(filters)
			: actions.forCard(cardId, filters),
	);
}
export function handleListCardEdits(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	history(req, res, ctx);
}
export function handleGetCardEditHistory(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): void {
	if (!params.id) throw new ValidationError("Missing card ID");
	let cardId: string;
	try {
		cardId = decodeURIComponent(params.id);
	} catch {
		throw new ValidationError("Invalid encoded card ID");
	}
	history(req, res, ctx, cardId);
}
