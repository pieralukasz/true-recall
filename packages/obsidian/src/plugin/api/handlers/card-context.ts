import { TFile } from "obsidian";
import { State } from "ts-fsrs";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendError, sendOk } from "../api.types";

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

export async function handleGetCardContext(
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

	const card = ctx.plugin.cardStore.cards.get(cardId);
	if (!card) {
		sendError(res, 404, "Card not found");
		return;
	}

	const history = ctx.plugin.cardStore.stats.getCardReviewHistory(cardId, 20);

	const result: Record<string, unknown> = {
		card: {
			id: card.id,
			question: card.question ?? "",
			answer: card.answer ?? "",
			cardType: card.cardType ?? "basic",
			state: card.state,
			stateLabel: STATE_LABELS[card.state] ?? "Unknown",
			due: card.due,
			stability: card.stability,
			difficulty: card.difficulty,
			reps: card.reps,
			lapses: card.lapses,
			lastReview: card.lastReview,
			sourceUid: card.sourceUid,
			sourceNoteName: card.sourceNoteName ?? "",
			sourceNotePath: card.sourceNotePath ?? "",
			noteTypeName: card.noteTypeName,
			...(card.sourceText && { sourceText: card.sourceText }),
			...(card.cardType === "cloze" && {
				clozeTemplate: card.clozeTemplate,
				clozeIndex: card.clozeIndex,
			}),
			...(card.reverseOf && { reverseOf: card.reverseOf }),
		},
		reviewHistory: history,
	};

	// Source note content
	if (card.sourceNotePath) {
		const abstractFile = ctx.plugin.app.vault.getAbstractFileByPath(
			card.sourceNotePath,
		);
		if (abstractFile instanceof TFile) {
			try {
				const content = await ctx.plugin.app.vault.read(abstractFile);
				result.sourceNote = {
					path: abstractFile.path,
					basename: abstractFile.basename,
					content,
				};
			} catch {
				// File read failed — omit
			}
		}
	}

	// Sibling cards from the same source note
	if (card.sourceUid) {
		const siblings = ctx.plugin.cardStore.cards
			.getCardsBySourceUid(card.sourceUid)
			.filter((c) => c.id !== cardId)
			.map((c) => ({
				id: c.id,
				question: c.question ?? "",
				answer: c.answer ?? "",
				cardType: c.cardType ?? "basic",
				state: c.state,
				stateLabel: STATE_LABELS[c.state] ?? "Unknown",
				stability: c.stability,
				difficulty: c.difficulty,
				reps: c.reps,
				lapses: c.lapses,
			}));

		result.siblings = { count: siblings.length, cards: siblings };
	} else {
		result.siblings = { count: 0, cards: [] };
	}

	sendOk(res, result);
}
