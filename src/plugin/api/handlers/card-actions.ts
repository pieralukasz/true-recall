import type { IncomingMessage, ServerResponse } from "http";
import { notifyCardChange } from "@shared/services/signals";
import type { ApiContext } from "../api.types";
import {
	parseJsonBody,
	readBody,
	sendError,
	sendOk,
} from "../api.types";

export async function handleSuspendCard(
	req: IncomingMessage,
	res: ServerResponse,
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
	req: IncomingMessage,
	res: ServerResponse,
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
		sendError(res, 400, "Body must contain { question?: string, answer?: string }");
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

	sendOk(res, {
		cardId,
		noteId,
		updatedFields: Object.keys(updatedFields),
	});
}

export async function handleDeleteCard(
	_req: IncomingMessage,
	res: ServerResponse,
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
