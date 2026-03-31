import { __awaiter } from "tslib";
import { notifyCardChange } from "@true-recall/obsidian/services/signals";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleSuspendCard(req, res, ctx, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const cardId = params.id;
        if (!cardId) {
            sendError(res, 400, "Missing card ID");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
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
        }
        else {
            ctx.plugin.cardStore.cards.bulkUnsuspend([cardId]);
        }
        notifyCardChange({ type: "updated", cardId, changes: { suspended: true } });
        sendOk(res, {
            cardId,
            suspended: body.suspended,
        });
    });
}
export function handleUpdateCard(req, res, ctx, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const cardId = params.id;
        if (!cardId) {
            sendError(res, 400, "Missing card ID");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
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
        const updatedFields = Object.assign({}, note.fields);
        if (isCloze) {
            if (body.question)
                updatedFields.Text = body.question;
            if (body.answer)
                updatedFields.Extra = body.answer;
        }
        else {
            if (body.question)
                updatedFields.Front = body.question;
            if (body.answer)
                updatedFields.Back = body.answer;
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
    });
}
export function handleDeleteCard(_req, res, ctx, params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const cardId = params.id;
        if (!cardId) {
            sendError(res, 400, "Missing card ID");
            return;
        }
        const ok = yield ctx.plugin.flashcardManager.removeFlashcard(cardId);
        if (!ok) {
            sendError(res, 404, "Card not found or already deleted");
            return;
        }
        sendOk(res, { deleted: true, cardId });
    });
}
export function handleBulkDelete(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!((_a = body === null || body === void 0 ? void 0 : body.card_ids) === null || _a === void 0 ? void 0 : _a.length)) {
            sendError(res, 400, "Body must contain { card_ids: string[] }");
            return;
        }
        const count = ctx.plugin.flashcardManager.removeFlashcardsByIds(body.card_ids);
        notifyCardChange({ type: "bulk", cardIds: body.card_ids });
        sendOk(res, { deleted: count, cardIds: body.card_ids });
    });
}
export function handleRemoveCardsFromNote(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        let sourceUid = body === null || body === void 0 ? void 0 : body.source_uid;
        // Resolve from path or active note
        if (!sourceUid && (body === null || body === void 0 ? void 0 : body.path)) {
            const file = ctx.plugin.app.vault.getAbstractFileByPath(body.path);
            if (file && "extension" in file) {
                sourceUid =
                    (_a = (yield ctx.plugin.flashcardManager
                        .getFrontmatterService()
                        .getSourceNoteUid(file.path))) !== null && _a !== void 0 ? _a : undefined;
            }
        }
        if (!sourceUid) {
            const file = ctx.plugin.app.workspace.getActiveFile();
            if (file) {
                sourceUid =
                    (_b = (yield ctx.plugin.flashcardManager
                        .getFrontmatterService()
                        .getSourceNoteUid(file.path))) !== null && _b !== void 0 ? _b : undefined;
            }
        }
        if (!sourceUid) {
            sendError(res, 400, "No source_uid provided and no active note with flashcard_uid");
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
    });
}
export function handleBulkSuspend(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!((_a = body === null || body === void 0 ? void 0 : body.card_ids) === null || _a === void 0 ? void 0 : _a.length) || typeof body.suspended !== "boolean") {
            sendError(res, 400, "Body must contain { card_ids: string[], suspended: boolean }");
            return;
        }
        const count = body.suspended
            ? ctx.plugin.cardStore.cards.bulkSuspend(body.card_ids)
            : ctx.plugin.cardStore.cards.bulkUnsuspend(body.card_ids);
        notifyCardChange({ type: "bulk", cardIds: body.card_ids });
        sendOk(res, { affected: count, suspended: body.suspended });
    });
}
export function handleBulkBury(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!((_a = body === null || body === void 0 ? void 0 : body.card_ids) === null || _a === void 0 ? void 0 : _a.length)) {
            sendError(res, 400, "Body must contain { card_ids: string[], until?: string, days?: number }");
            return;
        }
        let untilDate;
        if (body.until) {
            untilDate = new Date(body.until).toISOString();
        }
        else {
            const days = (_b = body.days) !== null && _b !== void 0 ? _b : 1;
            const d = new Date();
            d.setDate(d.getDate() + days);
            d.setHours(4, 0, 0, 0);
            untilDate = d.toISOString();
        }
        const count = ctx.plugin.cardStore.cards.bulkBury(body.card_ids, untilDate);
        notifyCardChange({ type: "bulk", cardIds: body.card_ids });
        sendOk(res, { buried: count, untilDate, cardIds: body.card_ids });
    });
}
