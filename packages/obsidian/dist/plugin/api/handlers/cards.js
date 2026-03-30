import { __awaiter } from "tslib";
import { BUILTIN_BASIC_ID, BUILTIN_CLOZE_ID } from "@true-recall/core/types/note.types";
import { State } from "ts-fsrs";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleListCards(req, res, ctx) {
    var _a, _b, _c;
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/", "http://localhost");
    const query = (_b = url.searchParams.get("q")) !== null && _b !== void 0 ? _b : undefined;
    const stateParam = url.searchParams.get("state");
    const sourceUid = (_c = url.searchParams.get("source_uid")) !== null && _c !== void 0 ? _c : undefined;
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const showSuspended = url.searchParams.get("suspended") === "true";
    const showArchived = url.searchParams.get("archived") === "true";
    let allCards = sourceUid
        ? ctx.plugin.cardStore.cards.getCardsBySourceUid(sourceUid)
        : ctx.plugin.cardStore.cards.getAll();
    if (!showSuspended) {
        allCards = allCards.filter((c) => !c.suspended);
    }
    if (!showArchived) {
        const archivedUids = ctx.plugin.hierarchyService.getArchivedSourceUids();
        if (archivedUids.size > 0) {
            allCards = allCards.filter((c) => !c.sourceUid || !archivedUids.has(c.sourceUid));
        }
    }
    if (stateParam !== null) {
        const stateMap = {
            new: State.New,
            learning: State.Learning,
            review: State.Review,
            relearning: State.Relearning,
        };
        const stateValue = stateMap[stateParam];
        if (stateValue !== undefined) {
            allCards = allCards.filter((c) => c.state === stateValue);
        }
    }
    if (query) {
        const q = query.toLowerCase();
        allCards = allCards.filter((c) => {
            var _a, _b;
            return ((_a = c.question) !== null && _a !== void 0 ? _a : "").toLowerCase().includes(q) ||
                ((_b = c.answer) !== null && _b !== void 0 ? _b : "").toLowerCase().includes(q);
        });
    }
    const cards = allCards.slice(0, limit).map((c) => {
        var _a, _b, _c;
        return ({
            id: c.id,
            question: (_a = c.question) !== null && _a !== void 0 ? _a : "",
            answer: (_b = c.answer) !== null && _b !== void 0 ? _b : "",
            state: c.state,
            due: c.due,
            stability: c.stability,
            difficulty: c.difficulty,
            reps: c.reps,
            lapses: c.lapses,
            cardType: (_c = c.cardType) !== null && _c !== void 0 ? _c : "basic",
            sourceUid: c.sourceUid,
            createdAt: c.createdAt,
            noteTypeName: c.noteTypeName,
        });
    });
    sendOk(res, { total: allCards.length, count: cards.length, cards });
}
export function handleGetCard(_req, res, ctx, params) {
    var _a, _b, _c;
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const cardId = params.id;
    if (!cardId) {
        sendError(res, 400, "Missing card ID");
        return;
    }
    const card = ctx.plugin.cardStore.cards.get(cardId);
    if (!card) {
        sendError(res, 404, "Card not found");
        return;
    }
    const history = ctx.plugin.cardStore.stats.getCardReviewHistory(cardId, 20);
    sendOk(res, {
        id: card.id,
        question: (_a = card.question) !== null && _a !== void 0 ? _a : "",
        answer: (_b = card.answer) !== null && _b !== void 0 ? _b : "",
        state: card.state,
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        reps: card.reps,
        lapses: card.lapses,
        lastReview: card.lastReview,
        scheduledDays: card.scheduledDays,
        suspended: card.suspended,
        cardType: (_c = card.cardType) !== null && _c !== void 0 ? _c : "basic",
        sourceUid: card.sourceUid,
        sourceText: card.sourceText,
        createdAt: card.createdAt,
        noteTypeName: card.noteTypeName,
        reviewHistory: history,
    });
}
export function handleGetDueCards(req, res, ctx) {
    var _a, _b, _c;
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/", "http://localhost");
    const showArchived = url.searchParams.get("archived") === "true";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const archivedUids = showArchived
        ? new Set()
        : ctx.plugin.hierarchyService.getArchivedSourceUids();
    let allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
    if (archivedUids.size > 0) {
        allCards = allCards.filter((c) => !c.sourceUid || !archivedUids.has(c.sourceUid));
    }
    const dueCards = ctx.plugin.dayBoundaryService.getDueCards(allCards);
    // Group by source note for summary
    const byNote = new Map();
    for (const c of dueCards) {
        const name = (_b = c.sourceNoteName) !== null && _b !== void 0 ? _b : "(orphaned)";
        byNote.set(name, ((_c = byNote.get(name)) !== null && _c !== void 0 ? _c : 0) + 1);
    }
    const noteBreakdown = [...byNote.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({ note: name, due: count }));
    const sliced = limit ? dueCards.slice(0, limit) : dueCards;
    const cards = sliced.map((c) => {
        var _a;
        return ({
            id: c.id,
            question: c.question,
            answer: c.answer,
            state: c.fsrs.state,
            due: c.fsrs.due,
            stability: c.fsrs.stability,
            difficulty: c.fsrs.difficulty,
            reps: c.fsrs.reps,
            lapses: c.fsrs.lapses,
            cardType: (_a = c.cardType) !== null && _a !== void 0 ? _a : "basic",
            sourceUid: c.sourceUid,
            sourceNoteName: c.sourceNoteName,
        });
    });
    sendOk(res, {
        dueCount: dueCards.length,
        showing: sliced.length,
        noteBreakdown,
        cards,
    });
}
export function handleGetProblemCards(req, res, ctx) {
    var _a;
    if (!ctx.plugin.isStoreReady()) {
        sendError(res, 503, "Database not ready");
        return;
    }
    const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "/", "http://localhost");
    const limit = Number(url.searchParams.get("limit")) || 20;
    const problems = ctx.plugin.cardStore.stats.getProblemCards(limit);
    sendOk(res, { count: problems.length, cards: problems });
}
export function handleCreateCards(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!ctx.plugin.isStoreReady()) {
            sendError(res, 503, "Database not ready");
            return;
        }
        const raw = yield readBody(req);
        const body = parseJsonBody(raw);
        if (!body) {
            sendError(res, 400, "Invalid JSON body");
            return;
        }
        let inputs;
        let batchSourceUid;
        if ("question" in body) {
            inputs = [body];
            batchSourceUid = undefined;
        }
        else {
            inputs = body.cards;
            batchSourceUid = body.source_uid;
        }
        const noteParams = inputs.map((input) => {
            var _a;
            const isCloze = input.card_type === "cloze";
            const noteTypeId = isCloze ? BUILTIN_CLOZE_ID : BUILTIN_BASIC_ID;
            const fields = isCloze
                ? { Text: input.question, Extra: input.answer }
                : { Front: input.question, Back: input.answer };
            return {
                noteTypeId,
                fields,
                sourceUid: (_a = input.source_uid) !== null && _a !== void 0 ? _a : batchSourceUid,
                sourceText: input.source_text,
                createdVia: "claude_code",
            };
        });
        const result = ctx.plugin.flashcardManager.createNoteBatch(noteParams);
        sendOk(res, {
            created: result.cards.length,
            cardIds: result.cards.map((c) => c.id),
        });
    });
}
