import { __awaiter } from "tslib";
import { ReviewService } from "@true-recall/core/services/review/review.service";
import { Rating, State } from "ts-fsrs";
import { parseJsonBody, readBody, sendError, sendOk } from "../api.types";
const STATE_LABELS = {
    [State.New]: "New",
    [State.Learning]: "Learning",
    [State.Review]: "Review",
    [State.Relearning]: "Relearning",
};
export function handleRevealAnswer(_req, res, ctx) {
    var _a, _b, _c;
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
        cardType: (_a = card.cardType) !== null && _a !== void 0 ? _a : "basic",
        state: card.fsrs.state,
        stateLabel: (_b = STATE_LABELS[card.fsrs.state]) !== null && _b !== void 0 ? _b : "Unknown",
        sourceNoteName: (_c = card.sourceNoteName) !== null && _c !== void 0 ? _c : "",
    });
}
export function handleGradeSessionCard(req, res, ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
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
        const ratingMap = {
            1: Rating.Again,
            2: Rating.Hard,
            3: Rating.Good,
            4: Rating.Easy,
        };
        const rating = ratingMap[ratingValue];
        const responseTime = Date.now() - review.questionShownTime;
        const isNewCard = card.fsrs.state === State.New;
        const previousState = card.fsrs.state;
        const preset = ctx.plugin.presetService.resolvePresetForCard(card);
        const presetSettings = ctx.plugin.presetService.toFSRSSettings(preset);
        const reviewService = new ReviewService();
        const { updatedCard, result } = reviewService.processAnswer(card, rating, ctx.plugin.fsrsService, responseTime, presetSettings);
        // Requeue logic for learning/relearning cards
        let requeueData;
        if (reviewService.shouldRequeue(updatedCard)) {
            const relativePosition = reviewService.getRequeuePosition(review.queue, review.currentIndex + 1, updatedCard, (_a = preset.reviewOrder) !== null && _a !== void 0 ? _a : ctx.plugin.settings.reviewOrder);
            requeueData = { card: updatedCard, position: relativePosition };
        }
        // Advance session state
        const hasMore = review.recordAnswerAndNext(rating, updatedCard, requeueData);
        // Persist FSRS update
        ctx.plugin.flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs);
        // Record stats
        try {
            ctx.plugin.cardStore.stats.addReviewLog(card.id, ratingValue, result.scheduledDays, result.elapsedDays, previousState, responseTime, preset.name);
            const { formatLocalDate } = yield import("@true-recall/core/utils");
            const today = formatLocalDate(new Date());
            ctx.plugin.cardStore.stats.updateDailyStats(today, Object.assign(Object.assign(Object.assign({ reviewsCompleted: 1, newCardsStudied: isNewCard ? 1 : 0, totalTimeMs: responseTime, [`${["", "again", "hard", "good", "easy"][ratingValue]}`]: 1 }, (previousState === State.New && { newCards: 1 })), (previousState === State.Learning && { learningCards: 1 })), (previousState === State.Review && { reviewCards: 1 })));
            ctx.plugin.cardStore.stats.recordReviewedCard(today, card.id);
        }
        catch (_f) {
            // Stats recording is non-critical
        }
        // Build response with next card info
        const nextCard = hasMore ? review.getCurrentCard() : null;
        sendOk(res, {
            graded: {
                cardId: card.id,
                rating: ratingValue,
                ratingLabel: ["", "Again", "Hard", "Good", "Easy"][ratingValue],
                newState: updatedCard.fsrs.state,
                newStateLabel: (_b = STATE_LABELS[updatedCard.fsrs.state]) !== null && _b !== void 0 ? _b : "Unknown",
                newDue: updatedCard.fsrs.due,
                scheduledDays: result.scheduledDays,
            },
            session: {
                hasMore,
                progress: review.getProgress(),
                badgeCounts: review.getBadgeCounts(),
            },
            nextCard: nextCard
                ? {
                    id: nextCard.id,
                    question: nextCard.question,
                    cardType: (_c = nextCard.cardType) !== null && _c !== void 0 ? _c : "basic",
                    state: nextCard.fsrs.state,
                    stateLabel: (_d = STATE_LABELS[nextCard.fsrs.state]) !== null && _d !== void 0 ? _d : "Unknown",
                    sourceNoteName: (_e = nextCard.sourceNoteName) !== null && _e !== void 0 ? _e : "",
                }
                : null,
        });
    });
}
