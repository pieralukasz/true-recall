import type { IncomingMessage, ServerResponse } from "http";
import { State } from "ts-fsrs";
import type { ApiContext } from "../api.types";
import { sendError, sendOk } from "../api.types";

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

function mapCard(c: {
	id: string;
	question?: string;
	answer?: string;
	cardType?: string;
	state: number;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	due: string;
	sourceUid?: string;
	sourceNoteName?: string;
	reverseOf?: string;
	clozeIndex?: number;
	noteTypeName?: string;
}) {
	return {
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
		due: c.due,
		sourceUid: c.sourceUid,
		sourceNoteName: c.sourceNoteName ?? "",
		...(c.reverseOf && { reverseOf: c.reverseOf }),
		...(c.clozeIndex !== undefined && { clozeIndex: c.clozeIndex }),
		...(c.noteTypeName && { noteTypeName: c.noteTypeName }),
	};
}

export async function handleGetCardRelations(
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

	const card = ctx.plugin.cardStore.cards.get(cardId);
	if (!card) {
		sendError(res, 404, "Card not found");
		return;
	}

	const relations: Record<string, unknown> = {
		card: mapCard(card),
	};

	// Sibling cards from the same source note
	if (card.sourceUid) {
		const siblings = ctx.plugin.cardStore.cards
			.getCardsBySourceUid(card.sourceUid)
			.filter((c) => c.id !== cardId);

		relations.siblings = {
			count: siblings.length,
			cards: siblings.map(mapCard),
		};
	} else {
		relations.siblings = { count: 0, cards: [] };
	}

	// Reverse card pair
	if (card.reverseOf) {
		const original = ctx.plugin.cardStore.cards.get(card.reverseOf);
		if (original) {
			relations.reverseOf = mapCard(original);
		}
	}

	// Find cards that are reverse of this card
	if (card.cardType === "basic") {
		const allCards = card.sourceUid
			? ctx.plugin.cardStore.cards.getCardsBySourceUid(card.sourceUid)
			: [];
		const reverseCards = allCards.filter((c) => c.reverseOf === cardId);
		if (reverseCards.length > 0) {
			relations.reversedBy = reverseCards.map(mapCard);
		}
	}

	// Cloze siblings (same template, different deletions)
	if (card.cardType === "cloze" && card.sourceUid && card.clozeTemplate) {
		const clozeSiblings = ctx.plugin.cardStore
			.getClozeSiblings(card.sourceUid, card.clozeTemplate)
			.filter((c) => c.id !== cardId);

		if (clozeSiblings.length > 0) {
			relations.clozeSiblings = {
				count: clozeSiblings.length,
				cards: clozeSiblings.map(mapCard),
			};
		}
	}

	sendOk(res, relations);
}
