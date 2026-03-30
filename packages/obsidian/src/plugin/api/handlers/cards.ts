import { BUILTIN_BASIC_ID, BUILTIN_CLOZE_ID } from "@true-recall/core/types/note.types";
import { State } from "ts-fsrs";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

export function handleListCards(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const url = new URL(req.url ?? "/", "http://localhost");
	const query = url.searchParams.get("q") ?? undefined;
	const stateParam = url.searchParams.get("state");
	const sourceUid = url.searchParams.get("source_uid") ?? undefined;
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
			allCards = allCards.filter(
				(c) => !c.sourceUid || !archivedUids.has(c.sourceUid),
			);
		}
	}

	if (stateParam !== null) {
		const stateMap: Record<string, State> = {
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
		allCards = allCards.filter(
			(c) =>
				(c.question ?? "").toLowerCase().includes(q) ||
				(c.answer ?? "").toLowerCase().includes(q),
		);
	}

	const cards = allCards.slice(0, limit).map((c) => ({
		id: c.id,
		question: c.question ?? "",
		answer: c.answer ?? "",
		state: c.state,
		due: c.due,
		stability: c.stability,
		difficulty: c.difficulty,
		reps: c.reps,
		lapses: c.lapses,
		cardType: c.cardType ?? "basic",
		sourceUid: c.sourceUid,
		createdAt: c.createdAt,
		noteTypeName: c.noteTypeName,
	}));

	sendOk(res, { total: allCards.length, count: cards.length, cards });
}

export function handleGetCard(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
	params: Record<string, string>,
): void {
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
		question: card.question ?? "",
		answer: card.answer ?? "",
		state: card.state,
		due: card.due,
		stability: card.stability,
		difficulty: card.difficulty,
		reps: card.reps,
		lapses: card.lapses,
		lastReview: card.lastReview,
		scheduledDays: card.scheduledDays,
		suspended: card.suspended,
		cardType: card.cardType ?? "basic",
		sourceUid: card.sourceUid,
		sourceText: card.sourceText,
		createdAt: card.createdAt,
		noteTypeName: card.noteTypeName,
		reviewHistory: history,
	});
}

export function handleGetDueCards(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const url = new URL(req.url ?? "/", "http://localhost");
	const showArchived = url.searchParams.get("archived") === "true";
	const limitParam = url.searchParams.get("limit");
	const limit = limitParam ? Number(limitParam) : undefined;

	const archivedUids = showArchived
		? new Set<string>()
		: ctx.plugin.hierarchyService.getArchivedSourceUids();

	let allCards = ctx.plugin.flashcardManager.getAllFSRSCards();

	if (archivedUids.size > 0) {
		allCards = allCards.filter(
			(c) => !c.sourceUid || !archivedUids.has(c.sourceUid),
		);
	}

	const dueCards = ctx.plugin.dayBoundaryService.getDueCards(allCards);

	// Group by source note for summary
	const byNote = new Map<string, number>();
	for (const c of dueCards) {
		const name = c.sourceNoteName ?? "(orphaned)";
		byNote.set(name, (byNote.get(name) ?? 0) + 1);
	}
	const noteBreakdown = [...byNote.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 20)
		.map(([name, count]) => ({ note: name, due: count }));

	const sliced = limit ? dueCards.slice(0, limit) : dueCards;
	const cards = sliced.map((c) => ({
		id: c.id,
		question: c.question,
		answer: c.answer,
		state: c.fsrs.state,
		due: c.fsrs.due,
		stability: c.fsrs.stability,
		difficulty: c.fsrs.difficulty,
		reps: c.fsrs.reps,
		lapses: c.fsrs.lapses,
		cardType: c.cardType ?? "basic",
		sourceUid: c.sourceUid,
		sourceNoteName: c.sourceNoteName,
	}));

	sendOk(res, {
		dueCount: dueCards.length,
		showing: sliced.length,
		noteBreakdown,
		cards,
	});
}

export function handleGetProblemCards(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const url = new URL(req.url ?? "/", "http://localhost");
	const limit = Number(url.searchParams.get("limit")) || 20;

	const problems = ctx.plugin.cardStore.stats.getProblemCards(limit);
	sendOk(res, { count: problems.length, cards: problems });
}

interface CreateCardInput {
	question: string;
	answer: string;
	source_uid?: string;
	source_text?: string;
	card_type?: "basic" | "cloze";
	tags?: string;
}

interface CreateBatchInput {
	cards: CreateCardInput[];
	source_uid?: string;
	tags?: string;
}

export async function handleCreateCards(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<CreateCardInput | CreateBatchInput>(raw);
	if (!body) {
		sendError(res, 400, "Invalid JSON body");
		return;
	}

	let inputs: CreateCardInput[];
	let batchSourceUid: string | undefined;

	if ("question" in body) {
		inputs = [body];
		batchSourceUid = undefined;
	} else {
		inputs = body.cards;
		batchSourceUid = body.source_uid;
	}

	const noteParams = inputs.map((input) => {
		const isCloze = input.card_type === "cloze";
		const noteTypeId = isCloze ? BUILTIN_CLOZE_ID : BUILTIN_BASIC_ID;
		const fields: Record<string, string> = isCloze
			? { Text: input.question, Extra: input.answer }
			: { Front: input.question, Back: input.answer };

		return {
			noteTypeId,
			fields,
			sourceUid: input.source_uid ?? batchSourceUid,
			sourceText: input.source_text,
			createdVia: "claude_code" as const,
		};
	});

	const result = ctx.plugin.flashcardManager.createNoteBatch(noteParams);

	sendOk(res, {
		created: result.cards.length,
		cardIds: result.cards.map((c) => c.id),
	});
}
