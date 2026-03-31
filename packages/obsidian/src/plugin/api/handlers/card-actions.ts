import { BuryCommand } from "@true-recall/obsidian/commands/commands/card-bury.cmd";
import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import {
	SuspendCommand,
	UnsuspendCommand,
} from "@true-recall/obsidian/commands/commands/card-suspend.cmd";
import { UpdateNoteFieldsCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";
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

	const cmd = body.suspended
		? new SuspendCommand([cardId])
		: new UnsuspendCommand([cardId]);
	await ctx.plugin.commandService?.execute(cmd);

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

	const isCloze = noteType.type === 1;
	const updatedFields = { ...note.fields };

	if (isCloze) {
		if (body.question) updatedFields.Text = body.question;
		if (body.answer) updatedFields.Extra = body.answer;
	} else {
		if (body.question) updatedFields.Front = body.question;
		if (body.answer) updatedFields.Back = body.answer;
	}

	const previousFields = { ...note.fields };
	ctx.plugin.flashcardManager.updateNoteFields(noteId, updatedFields);

	const cmd = new UpdateNoteFieldsCommand(noteId, previousFields, "Edit card");
	await ctx.plugin.commandService?.execute(cmd);

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

	const cmd = new DeleteCardCommand([cardId]);
	await ctx.plugin.commandService?.execute(cmd);

	if (cmd.deletedCount === 0) {
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

	const cmd = new DeleteCardCommand(body.card_ids);
	await ctx.plugin.commandService?.execute(cmd);

	sendOk(res, { deleted: cmd.deletedCount, cardIds: body.card_ids });
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
	const cmd = new DeleteCardCommand(ids);
	await ctx.plugin.commandService?.execute(cmd);

	sendOk(res, { deleted: cmd.deletedCount, sourceUid, cardIds: ids });
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

	const cmd = body.suspended
		? new SuspendCommand(body.card_ids)
		: new UnsuspendCommand(body.card_ids);
	await ctx.plugin.commandService?.execute(cmd);

	sendOk(res, { affected: body.card_ids.length, suspended: body.suspended });
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

	const cmd = new BuryCommand(body.card_ids, untilDate);
	await ctx.plugin.commandService?.execute(cmd);

	sendOk(res, {
		buried: body.card_ids.length,
		untilDate,
		cardIds: body.card_ids,
	});
}
