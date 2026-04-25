import { type Grade, Rating, State } from "ts-fsrs";

import { shouldTriggerLeech } from "@true-recall/core/helpers/leech-helpers";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

const STATE_LABELS: Record<number, string> = {
	[State.New]: "New",
	[State.Learning]: "Learning",
	[State.Review]: "Review",
	[State.Relearning]: "Relearning",
};

export function handleRevealAnswer(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.store) {
		sendError(res, 503, "Store not ready");
		return;
	}

	const review = ctx.plugin.store.getState().review;
	const card = review.getCurrentCard();
	if (!card) {
		sendError(res, 404, "No active review card");
		return;
	}

	review.revealAnswer();

	sendOk(res, {
		cardId: card.id,
		question: card.question,
		answer: card.answer,
		cardType: card.cardType ?? "basic",
		state: card.fsrs.state,
		stateLabel: STATE_LABELS[card.fsrs.state] ?? "Unknown",
		sourceNoteName: card.sourceNoteName ?? "",
	});
}

interface GradeSessionInput {
	rating: number;
}

export async function handleGradeSessionCard(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.store || !ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Store not ready");
		return;
	}

	const review = ctx.plugin.store.getState().review;
	const card = review.getCurrentCard();

	if (!card) {
		sendError(res, 404, "No active review card");
		return;
	}

	const raw = await readBody(req);
	const body = parseJsonBody<GradeSessionInput>(raw);
	if (!body || typeof body.rating !== "number") {
		sendError(res, 400, "Invalid body: { rating: 1-4 } required");
		return;
	}

	const ratingValue = body.rating;
	if (ratingValue < 1 || ratingValue > 4) {
		sendError(
			res,
			400,
			"Rating must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)",
		);
		return;
	}

	const ratingMap: Record<number, Grade> = {
		1: Rating.Again,
		2: Rating.Hard,
		3: Rating.Good,
		4: Rating.Easy,
	};

	const outcome = ctx.plugin.reviewController.gradeCurrentCard(
		ratingMap[ratingValue] as Grade,
		review.getSessionFilters(),
	);
	if (!outcome) {
		sendError(res, 404, "No active review card");
		return;
	}

	const nextCard = outcome.nextCard;
	const leechThreshold = outcome.preset.leechThreshold ?? 8;
	const leechAction = outcome.preset.leechAction ?? "tag-only";
	const leechTriggered =
		ratingValue === 1 &&
		shouldTriggerLeech(outcome.updatedCard.fsrs.lapses, leechThreshold);

	sendOk(res, {
		graded: {
			cardId: outcome.card.id,
			rating: ratingValue,
			ratingLabel: ["", "Again", "Hard", "Good", "Easy"][ratingValue],
			newState: outcome.updatedCard.fsrs.state,
			newStateLabel: STATE_LABELS[outcome.updatedCard.fsrs.state] ?? "Unknown",
			newDue: outcome.updatedCard.fsrs.due,
			scheduledDays: outcome.result.scheduledDays,
			leech: leechTriggered
				? {
						suspended: outcome.leechSuspended,
						action: leechAction,
						lapses: outcome.updatedCard.fsrs.lapses,
						threshold: leechThreshold,
					}
				: null,
		},
		session: {
			hasMore: outcome.hasMore,
			progress: review.getProgress(),
			badgeCounts: review.getBadgeCounts(),
		},
		nextCard: nextCard
			? {
					id: nextCard.id,
					question: nextCard.question,
					cardType: nextCard.cardType ?? "basic",
					state: nextCard.fsrs.state,
					stateLabel: STATE_LABELS[nextCard.fsrs.state] ?? "Unknown",
					sourceNoteName: nextCard.sourceNoteName ?? "",
				}
			: null,
	});
}
