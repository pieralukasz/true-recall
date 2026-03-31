/**
 * Postpone/Advance Service
 *
 * Shifts card due dates forward (postpone) or backward (advance) in bulk.
 */
/**
 * Postpone/Advance Service
 *
 * Allows bulk shifting of due dates for workload management.
 */
export class PostponeAdvanceService {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    /**
     * Shift card due dates
     */
    shift(options) {
        var _a, _b;
        const { action, days, scope, cardIds, dryRun = true } = options;
        const cards = this.getCardsForScope(scope, cardIds);
        // Calculate shift direction
        const shiftDays = action === "postpone" ? days : -days;
        // Record changes
        const changes = [];
        const beforeDistribution = new Map();
        const afterDistribution = new Map();
        for (const card of cards) {
            const originalDate = new Date(card.due);
            const newDate = new Date(originalDate);
            newDate.setDate(newDate.getDate() + shiftDays);
            // Don't advance past today
            if (action === "advance") {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (newDate < today) {
                    newDate.setTime(today.getTime());
                }
            }
            const originalDateStr = this.formatDate(originalDate);
            const newDateStr = this.formatDate(newDate);
            // Track distribution
            beforeDistribution.set(originalDateStr, ((_a = beforeDistribution.get(originalDateStr)) !== null && _a !== void 0 ? _a : 0) + 1);
            afterDistribution.set(newDateStr, ((_b = afterDistribution.get(newDateStr)) !== null && _b !== void 0 ? _b : 0) + 1);
            const change = {
                cardId: card.id,
                originalDue: card.due,
                newDue: newDate.toISOString(),
                daysChanged: shiftDays,
            };
            changes.push(change);
        }
        // Apply changes if not dry run
        if (!dryRun) {
            for (const change of changes) {
                this.cardStore.updateCardDue(change.cardId, change.newDue);
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
                    return card ? { id: card.id, due: card.due } : null;
                })
                    .filter((c) => c !== null);
            case "due_today": {
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return this.cardStore
                    .getDueCardsByDateRange(this.formatDate(today), this.formatDate(tomorrow))
                    .map((c) => ({ id: c.id, due: c.due }));
            }
            case "overdue": {
                const allCards = this.cardStore.getCards();
                return allCards
                    .filter((c) => new Date(c.due) < today && !c.suspended)
                    .map((c) => ({ id: c.id, due: c.due }));
            }
            default: {
                const allCards = this.cardStore.getCards();
                return allCards
                    .filter((c) => !c.suspended && c.state !== 0) // Exclude new and suspended
                    .map((c) => ({ id: c.id, due: c.due }));
            }
        }
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
