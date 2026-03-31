import { __awaiter } from "tslib";
import { assessTypedAnswer } from "@true-recall/core/helpers/answer-assessment";
import { shouldTriggerLeech } from "@true-recall/core/helpers/leech-helpers";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { notifyCardChange } from "@true-recall/obsidian/services/signals";
import { Rating, State } from "ts-fsrs";
export class AnswerHandler {
    constructor(deps) {
        this.deps = deps;
        this.pendingPreviewRafId = null;
    }
    resolvePreset(card) {
        var _a, _b;
        const uid = (_a = card.sourceUid) !== null && _a !== void 0 ? _a : "";
        return ((_b = this.deps.getPresetCache().get(uid)) !== null && _b !== void 0 ? _b : this.deps.plugin.presetService.resolvePresetForCard(card, {
            projectPath: this.deps.getFilters().projectPath,
        }));
    }
    deferSchedulingPreview() {
        if (this.pendingPreviewRafId !== null) {
            cancelAnimationFrame(this.pendingPreviewRafId);
        }
        this.pendingPreviewRafId = requestAnimationFrame(() => {
            this.pendingPreviewRafId = null;
            this.updateSchedulingPreview();
        });
    }
    updateSchedulingPreview() {
        const card = this.deps.getReview().getCurrentCard();
        if (card) {
            const preset = this.resolvePreset(card);
            const presetSettings = this.deps.plugin.presetService.toFSRSSettings(preset);
            const preview = this.deps.fsrsService.getSchedulingPreview(card.fsrs, presetSettings);
            this.deps.getReview().setSchedulingPreview(preview);
            this.deps.getReview().notifyChange();
        }
    }
    handleShowAnswer() {
        this.deps.getReview().revealAnswer();
        if (!this.deps.getReview().getSchedulingPreview()) {
            this.deferSchedulingPreview();
        }
    }
    prepareTypedAnswerAssessment(typedAnswer) {
        var _a;
        const card = this.deps.getReview().getCurrentCard();
        if (!card)
            return null;
        this.handleShowAnswer();
        const localAssessment = assessTypedAnswer((_a = card.answer) !== null && _a !== void 0 ? _a : "", typedAnswer);
        return { card, localAssessment };
    }
    gradeTypedAnswerSemantically(card, typedAnswer, localFallbackScore, passThreshold, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const result = yield this.deps.semanticGradingService.gradeAnswer({
                question: card.question,
                correctAnswer: (_a = card.answer) !== null && _a !== void 0 ? _a : "",
                userAnswer: typedAnswer,
                passThreshold,
                localFallbackScore,
                sourceContext: options === null || options === void 0 ? void 0 : options.sourceContext,
            });
            if ((options === null || options === void 0 ? void 0 : options.allowLocalFallback) === false &&
                result.source === "local-fallback") {
                throw new Error("AI grading unavailable. Please rate manually.");
            }
            return result;
        });
    }
    handleAnswer(rating) {
        var _a, _b;
        const review = this.deps.getReview();
        const card = review.getCurrentCard();
        if (!card)
            return;
        const currentIndex = review.currentIndex;
        const responseTime = Date.now() - review.questionShownTime;
        const isNewCard = card.fsrs.state === State.New;
        const previousState = card.fsrs.state;
        const preset = this.resolvePreset(card);
        const presetSettings = this.deps.plugin.presetService.toFSRSSettings(preset);
        const { updatedCard, result } = this.deps.reviewService.processAnswer(card, rating, this.deps.fsrsService, responseTime, presetSettings);
        // Cramming mode: skip persistence
        if (this.deps.getFilters().crammingMode) {
            this.deps.getCrammedCardIds().add(card.id);
            const hasMore = review.recordAnswerAndNext(rating, updatedCard);
            if (hasMore) {
                this.deferSchedulingPreview();
            }
            return;
        }
        let requeueData;
        if (this.deps.reviewService.shouldRequeue(updatedCard)) {
            const relativePosition = this.deps.reviewService.getRequeuePosition(review.queue, review.currentIndex + 1, updatedCard, (_a = preset.reviewOrder) !== null && _a !== void 0 ? _a : this.deps.plugin.settings.reviewOrder);
            requeueData = {
                card: updatedCard,
                position: relativePosition,
            };
        }
        const hasMore = review.recordAnswerAndNext(rating, updatedCard, requeueData);
        // Auto-bury siblings (IO + cloze) if enabled
        const buriedSiblings = preset.burySiblings !== false ? this.burySiblingCards(card) : [];
        if (hasMore) {
            this.deferSchedulingPreview();
        }
        // Leech detection: check if card has exceeded the lapse threshold
        if (rating === Rating.Again) {
            this.checkLeech(updatedCard, preset);
        }
        // Undo entry with deferred persistence
        let writeExecuted = false;
        let pendingTimeoutId = null;
        (_b = this.deps.plugin.undoService) === null || _b === void 0 ? void 0 : _b.push({
            id: crypto.randomUUID(),
            actionType: "answer",
            description: `Review (${Rating[rating]})`,
            timestamp: Date.now(),
            payload: {
                type: "answer",
                card: Object.assign({}, card),
                originalFsrs: Object.assign({}, card.fsrs),
                previousIndex: currentIndex,
                wasNewCard: isNewCard,
                rating,
                previousState,
                requeuedAtIndex: requeueData === null || requeueData === void 0 ? void 0 : requeueData.position,
                buriedSiblingIds: buriedSiblings.length > 0
                    ? buriedSiblings.map((s) => s.id)
                    : undefined,
                buriedSiblings: buriedSiblings.length > 0 ? buriedSiblings : undefined,
            },
            cancelPendingWrite: () => {
                if (!writeExecuted && pendingTimeoutId !== null) {
                    clearTimeout(pendingTimeoutId);
                    pendingTimeoutId = null;
                    return true;
                }
                return false;
            },
        });
        // Defer persistence until after the browser paints the next card
        pendingTimeoutId = setTimeout(() => {
            writeExecuted = true;
            pendingTimeoutId = null;
            const persisted = this.deps.flashcardManager.updateCardFSRS(card.id, updatedCard.fsrs, undefined, { skipNotification: true });
            if (!persisted) {
                const runtimeReview = this.deps.getReview();
                runtimeReview.removeCardById(card.id);
                this.deps.sessionPersistence.removeReviewedCards([card.id]);
                if (!runtimeReview.isComplete()) {
                    this.updateSchedulingPreview();
                }
                return;
            }
            try {
                this.deps.sessionPersistence.recordReview(card.id, isNewCard, responseTime, rating, previousState, result.scheduledDays, result.elapsedDays, preset.name);
            }
            catch (error) {
                console.error("Error recording review to persistent storage:", error);
            }
            notifyCardChange({
                type: "reviewed",
                cardId: card.id,
                rating: rating,
                newState: updatedCard.fsrs.state,
            });
        }, 0);
    }
    // Remove sibling IO/cloze cards from the queue after answering one.
    // Returns removed cards so they can be restored on undo.
    burySiblingCards(card) {
        if (card.cardType !== "image-occlusion" && card.cardType !== "cloze") {
            return [];
        }
        if (!card.noteId)
            return [];
        const review = this.deps.getReview();
        const queue = review.queue;
        const currentIdx = review.currentIndex;
        // Find siblings: same noteId, different id, still ahead in queue
        const siblings = [];
        for (let i = currentIdx; i < queue.length; i++) {
            const c = queue[i];
            if (c && c.id !== card.id && c.noteId === card.noteId) {
                siblings.push(Object.assign({}, c));
            }
        }
        // Remove siblings from queue
        for (const sibling of siblings) {
            review.removeCardById(sibling.id);
        }
        return siblings;
    }
    // Anki-style leech detection: triggers at threshold, then every half-threshold after.
    checkLeech(card, preset) {
        var _a, _b;
        const threshold = (_a = preset.leechThreshold) !== null && _a !== void 0 ? _a : 8;
        if (!shouldTriggerLeech(card.fsrs.lapses, threshold))
            return;
        const action = (_b = preset.leechAction) !== null && _b !== void 0 ? _b : "tag-only";
        const lapses = card.fsrs.lapses;
        const preview = card.question.slice(0, 50);
        if (action === "suspend") {
            this.deps.flashcardManager.updateCardFSRS(card.id, Object.assign(Object.assign({}, card.fsrs), { suspended: true }));
            this.deps.getReview().removeCardById(card.id);
            notify().warning(`Leech suspended (${lapses} lapses): ${preview}`);
        }
        else {
            notify().info(`Leech detected (${lapses} lapses): ${preview}`);
        }
    }
    handleUndoAnswer(payload, writeCancelled) {
        var _a;
        try {
            if (!writeCancelled) {
                this.deps.sessionPersistence.removeLastReview(payload.card.id, (_a = payload.wasNewCard) !== null && _a !== void 0 ? _a : false, payload.rating, payload.previousState);
            }
            // Restore buried siblings back into the queue before undoing the answer
            if (payload.buriedSiblings && payload.buriedSiblings.length > 0) {
                const review = this.deps.getReview();
                for (const sibling of payload.buriedSiblings) {
                    review.insertCardAtPosition(sibling, review.queue.length);
                }
            }
            this.deps
                .getReview()
                .undoLastAnswer(payload.previousIndex, Object.assign(Object.assign({}, payload.card), { fsrs: payload.originalFsrs }), payload.requeuedAtIndex);
        }
        catch (error) {
            console.error("Error undoing answer:", error);
        }
    }
}
