import { __awaiter } from "tslib";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import { Rating } from "ts-fsrs";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
export function handleGradeCard(req, res, ctx, params) {
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
        if (!body || typeof body.rating !== "number") {
            sendError(res, 400, "Invalid body: { rating: 1-4 } required");
            return;
        }
        const ratingValue = body.rating;
        if (ratingValue < 1 || ratingValue > 4) {
            sendError(res, 400, "Rating must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)");
            return;
        }
        const allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
        const card = allCards.find((c) => c.id === cardId);
        if (!card) {
            sendError(res, 404, "Card not found");
            return;
        }
        const ratingMap = {
            1: Rating.Again,
            2: Rating.Hard,
            3: Rating.Good,
            4: Rating.Easy,
        };
        const reviewService = new ReviewService();
        const { updatedCard, result, persisted } = yield reviewService.gradeCard(card, ratingMap[ratingValue], ctx.plugin.fsrsService, ctx.plugin.flashcardManager);
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
    });
}
