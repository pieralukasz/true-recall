import { type Grade, Rating } from "ts-fsrs";

import { ReviewService } from "@true-recall/core/services/review/review.service";

import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";

interface GradeInput {
	rating: number;
}

export async function handleGradeCard(
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
	const body = parseJsonBody<GradeInput>(raw);
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

	const allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
	const card = allCards.find((c) => c.id === cardId);
	if (!card) {
		sendError(res, 404, "Card not found");
		return;
	}

	const ratingMap: Record<number, Grade> = {
		1: Rating.Again,
		2: Rating.Hard,
		3: Rating.Good,
		4: Rating.Easy,
	};

	const grade = ratingMap[ratingValue];
	if (!grade) {
		sendError(res, 400, "Invalid rating value");
		return;
	}

	const reviewService = new ReviewService();
	const { updatedCard, result, persisted } = reviewService.gradeCard(
		card,
		grade,
		ctx.plugin.fsrsService,
		ctx.plugin.flashcardManager,
	);

	sendOk(res, {
		persisted,
		cardId: updatedCard.id,
		newState: updatedCard.fsrs.state,
		newDue: updatedCard.fsrs.due,
		newStability: updatedCard.fsrs.stability,
		newDifficulty: updatedCard.fsrs.difficulty,
		rating: ratingValue,
		ratingLabel: ["", "Again", "Hard", "Good", "Easy"][ratingValue],
		scheduledDays: result.scheduledDays,
	});
}
