import { notifyCardChange } from "@true-recall/obsidian/services/signals";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

export async function handleSuspendCard(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const cardId = params.id;
	if (!cardId) {
		sendError(res, 400, "Missing card ID");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<{ suspended: boolean }>(raw);
	if (!body || typeof body.suspended !== "boolean") {
		sendError(res, 400, "Body must contain { suspended: boolean }");
		return;
	}

	const card = ctx.plugin.cardStore.cards.get(cardId);
	if (!card) {
		sendError(res, 404, "Card not found");
		return;
	}

	if (body.suspended) {
		ctx.plugin.cardStore.cards.bulkSuspend([cardId]);
	} else {
		ctx.plugin.cardStore.cards.bulkUnsuspend([cardId]);
	}

	notifyCardChange({ type: "updated", cardId, changes: { suspended: true } });

	sendOk(res, {
		cardId,
		suspended: body.suspended,
	});
}

interface UpdateCardInput {
	question?: string;
	answer?: string;
}

export async function handleUpdateCard(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const cardId = params.id;
	if (!cardId) {
		sendError(res, 400, "Missing card ID");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<UpdateCardInput>(raw);
	if (!body || (!body.question && !body.answer)) {
		sendError(
			res,
			400,
			"Body must contain { question?: string, answer?: string }",
		);
		return;
	}

	const card = ctx.plugin.cardStore.cards.get(cardId);
	if (!card) {
		sendError(res, 404, "Card not found");
		return;
	}

	const noteId = card.noteId;
	if (!noteId) {
		sendError(res, 400, "Card has no associated note");
		return;
	}

	const note = ctx.plugin.cardStore.notes.getById(noteId);
	if (!note) {
		sendError(res, 404, "Note not found");
		return;
	}

	const noteType = ctx.plugin.cardStore.noteTypes.getById(note.noteTypeId);
	if (!noteType) {
		sendError(res, 404, "Note type not found");
		return;
	}

	// Map question/answer to the appropriate fields
	const isCloze = noteType.type === 1;
	const updatedFields = { ...note.fields };

	if (isCloze) {
		if (body.question) updatedFields.Text = body.question;
		if (body.answer) updatedFields.Extra = body.answer;
	} else {
		if (body.question) updatedFields.Front = body.question;
		if (body.answer) updatedFields.Back = body.answer;
	}

	ctx.plugin.flashcardManager.updateNoteFields(noteId, updatedFields);
	notifyCardChange({
		type: "updated",
		cardId,
		changes: {
			question: !!body.question,
			answer: !!body.answer,
		},
	});

	sendOk(res, {
		cardId,
		noteId,
		updatedFields: Object.keys(updatedFields),
	});
}

export async function handleDeleteCard(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const cardId = params.id;
	if (!cardId) {
		sendError(res, 400, "Missing card ID");
		return;
	}

	const ok = await ctx.plugin.flashcardManager.removeFlashcard(cardId);

	if (!ok) {
		sendError(res, 404, "Card not found or already deleted");
		return;
	}

	sendOk(res, { deleted: true, cardId });
}

export async function handleBulkDelete(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<{ card_ids: string[] }>(raw);
	if (!body?.card_ids?.length) {
		sendError(res, 400, "Body must contain { card_ids: string[] }");
		return;
	}

	const count = ctx.plugin.flashcardManager.removeFlashcardsByIds(
		body.card_ids,
	);

	notifyCardChange({ type: "bulk", cardIds: body.card_ids });
	sendOk(res, { deleted: count, cardIds: body.card_ids });
}

export async function handleRemoveCardsFromNote(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<{ source_uid?: string; path?: string }>(raw);

	let sourceUid = body?.source_uid;

	// Resolve from path or active note
	if (!sourceUid && body?.path) {
		const file = ctx.plugin.app.vault.getAbstractFileByPath(body.path);
		if (file && "extension" in file) {
			sourceUid =
				(await ctx.plugin.flashcardManager
					.getFrontmatterService()
					.getSourceNoteUid(file.path)) ?? undefined;
		}
	}
	if (!sourceUid) {
		const file = ctx.plugin.app.workspace.getActiveFile();
		if (file) {
			sourceUid =
				(await ctx.plugin.flashcardManager
					.getFrontmatterService()
					.getSourceNoteUid(file.path)) ?? undefined;
		}
	}

	if (!sourceUid) {
		sendError(
			res,
			400,
			"No source_uid provided and no active note with flashcard_uid",
		);
		return;
	}

	const cards = ctx.plugin.cardStore.cards.getCardsBySourceUid(sourceUid);
	if (cards.length === 0) {
		sendOk(res, { deleted: 0, sourceUid });
		return;
	}

	const ids = cards.map((c) => c.id);
	const count = ctx.plugin.flashcardManager.removeFlashcardsByIds(ids);

	notifyCardChange({ type: "bulk", cardIds: ids });
	sendOk(res, { deleted: count, sourceUid, cardIds: ids });
}

export async function handleBulkSuspend(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<{
		card_ids: string[];
		suspended: boolean;
	}>(raw);
	if (!body?.card_ids?.length || typeof body.suspended !== "boolean") {
		sendError(
			res,
			400,
			"Body must contain { card_ids: string[], suspended: boolean }",
		);
		return;
	}

	const count = body.suspended
		? ctx.plugin.cardStore.cards.bulkSuspend(body.card_ids)
		: ctx.plugin.cardStore.cards.bulkUnsuspend(body.card_ids);

	notifyCardChange({ type: "bulk", cardIds: body.card_ids });
	sendOk(res, { affected: count, suspended: body.suspended });
}

export async function handleBulkBury(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<{
		card_ids: string[];
		until?: string;
		days?: number;
	}>(raw);
	if (!body?.card_ids?.length) {
		sendError(
			res,
			400,
			"Body must contain { card_ids: string[], until?: string, days?: number }",
		);
		return;
	}

	let untilDate: string;
	if (body.until) {
		untilDate = new Date(body.until).toISOString();
	} else {
		const days = body.days ?? 1;
		const d = new Date();
		d.setDate(d.getDate() + days);
		d.setHours(4, 0, 0, 0);
		untilDate = d.toISOString();
	}

	const count = ctx.plugin.cardStore.cards.bulkBury(body.card_ids, untilDate);

	notifyCardChange({ type: "bulk", cardIds: body.card_ids });
	sendOk(res, { buried: count, untilDate, cardIds: body.card_ids });
}
