/**
 * Reschedule Service
 *
 * Recalculates all card intervals based on current FSRS weights.
 * Useful after parameter optimization to apply new weights to existing cards.
 */
import { DEFAULT_FSRS_WEIGHTS } from "../../../constants";
import { FSRS, State } from "ts-fsrs";
export class RescheduleService {
    constructor(cardStore, fsrsSettings) {
        var _a;
        this.cardStore = cardStore;
        this.fsrs = new FSRS({
            request_retention: fsrsSettings.requestRetention,
            maximum_interval: fsrsSettings.maximumInterval,
            w: (_a = fsrsSettings.weights) !== null && _a !== void 0 ? _a : DEFAULT_FSRS_WEIGHTS,
            enable_fuzz: false, // No fuzz for rescheduling — deterministic intervals
        });
    }
    /**
     * Reschedule cards based on current FSRS weights
     */
    reschedule(options) {
        var _a, _b, _c;
        const { scope, cardIds, dryRun = true } = options;
        const cards = this.getCardsForScope(scope, cardIds);
        const changes = [];
        const beforeDistribution = new Map();
        const afterDistribution = new Map();
        for (const card of cards) {
            // Skip New and Learning/Relearning cards — only Review cards use stability-based intervals
            if (card.state === State.New ||
                card.state === State.Learning ||
                card.state === State.Relearning)
                continue;
            // Record before
            const beforeDateStr = this.formatDate(new Date(card.due));
            beforeDistribution.set(beforeDateStr, ((_a = beforeDistribution.get(beforeDateStr)) !== null && _a !== void 0 ? _a : 0) + 1);
            const lastReview = card.lastReview
                ? new Date(card.lastReview)
                : new Date();
            const elapsedDays = Math.max(0, Math.floor((Date.now() - lastReview.getTime()) / 86400000));
            // Delegate to ts-fsrs which uses the correct FSRS-6 power-law formula
            // (includes interval_modifier, clamping to [1, maximumInterval], no fuzz)
            const newInterval = this.fsrs.next_interval(card.stability, elapsedDays);
            const newDue = new Date(lastReview);
            newDue.setDate(newDue.getDate() + newInterval);
            const afterDateStr = this.formatDate(newDue);
            afterDistribution.set(afterDateStr, ((_b = afterDistribution.get(afterDateStr)) !== null && _b !== void 0 ? _b : 0) + 1);
            const originalDueMs = new Date(card.due).getTime();
            const newDueMs = newDue.getTime();
            if (Math.abs(originalDueMs - newDueMs) > 86400000) {
                const change = {
                    cardId: card.id,
                    originalDue: card.due,
                    newDue: newDue.toISOString(),
                    daysChanged: this.daysBetween(new Date(card.due), newDue),
                };
                changes.push(change);
            }
        }
        if (!dryRun) {
            for (const change of changes) {
                const lastReview = (_c = cards.find((c) => c.id === change.cardId)) === null || _c === void 0 ? void 0 : _c.lastReview;
                const reviewDate = lastReview ? new Date(lastReview) : new Date();
                const scheduledDays = Math.max(1, this.daysBetween(reviewDate, new Date(change.newDue)));
                this.cardStore.updateCardScheduling(change.cardId, {
                    due: change.newDue,
                    scheduledDays,
                });
            }
        }
        return {
            affectedCount: changes.length,
            beforeDistribution: this.mapToDistribution(beforeDistribution),
            afterDistribution: this.mapToDistribution(afterDistribution),
            changes,
        };
    }
    /**
     * Get cards based on scope
     */
    getCardsForScope(scope, cardIds) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        switch (scope) {
            case "selected":
                if (!cardIds || cardIds.length === 0)
                    return [];
                return cardIds
                    .map((id) => {
                    const card = this.cardStore.get(id);
                    return card
                        ? {
                            id: card.id,
                            due: card.due,
                            state: card.state,
                            stability: card.stability,
                            lastReview: card.lastReview,
                        }
                        : null;
                })
                    .filter((c) => c !== null);
            case "due": {
                const allCards = this.cardStore.getCards();
                return allCards
                    .filter((c) => new Date(c.due) <= today && !c.suspended && c.state !== State.New)
                    .map((c) => ({
                    id: c.id,
                    due: c.due,
                    state: c.state,
                    stability: c.stability,
                    lastReview: c.lastReview,
                }));
            }
            case "overdue": {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const allCards = this.cardStore.getCards();
                return allCards
                    .filter((c) => new Date(c.due) < today && !c.suspended && c.state !== State.New)
                    .map((c) => ({
                    id: c.id,
                    due: c.due,
                    state: c.state,
                    stability: c.stability,
                    lastReview: c.lastReview,
                }));
            }
            default: {
                const allCards = this.cardStore.getCards();
                return allCards
                    .filter((c) => !c.suspended && c.state !== State.New)
                    .map((c) => ({
                    id: c.id,
                    due: c.due,
                    state: c.state,
                    stability: c.stability,
                    lastReview: c.lastReview,
                }));
            }
        }
    }
    /**
     * Calculate days between two dates
     */
    daysBetween(from, to) {
        const diff = to.getTime() - from.getTime();
        return Math.round(diff / (1000 * 60 * 60 * 24));
    }
    /**
     * Format date as YYYY-MM-DD
     */
    formatDate(date) {
        var _a;
        return (_a = date.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
    }
    /**
     * Convert distribution map to array
     */
    mapToDistribution(map) {
        return Array.from(map.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
