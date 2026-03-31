/**
 * Flatten Service
 *
 * Redistributes excess cards from overloaded days to nearby days.
 */
/**
 * Flatten Service
 *
 * When a day exceeds the maximum card limit, excess cards are
 * moved to adjacent days to reduce the peak.
 */
export class FlattenService {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    /**
     * Flatten a specific date by moving excess cards
     */
    flatten(options) {
        var _a, _b;
        const { date, maxCards, dryRun = true } = options;
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = this.formatDate(nextDate);
        const cards = this.cardStore.getDueCardsByDateRange(date, nextDateStr);
        const changes = [];
        const beforeDistribution = new Map();
        const afterDistribution = new Map();
        // Record before
        beforeDistribution.set(date, cards.length);
        if (cards.length <= maxCards) {
            // No flattening needed
            return {
                affectedCount: 0,
                beforeDistribution: [{ date, count: cards.length }],
                afterDistribution: [{ date, count: cards.length }],
                changes: [],
            };
        }
        // Sort cards by scheduled_days (move longer interval cards first)
        const sortedCards = [...cards].sort((a, b) => b.scheduledDays - a.scheduledDays);
        // Keep maxCards, redistribute the rest
        const toKeep = sortedCards.slice(0, maxCards);
        const toMove = sortedCards.slice(maxCards);
        afterDistribution.set(date, toKeep.length);
        // Distribute excess cards to following days
        let offset = 1;
        for (const card of toMove) {
            const targetDate = new Date(date);
            targetDate.setDate(targetDate.getDate() + offset);
            const targetDateStr = this.formatDate(targetDate);
            const targetCount = (_a = afterDistribution.get(targetDateStr)) !== null && _a !== void 0 ? _a : 0;
            if (targetCount >= maxCards) {
                offset++;
                // Recalculate target date
                targetDate.setDate(new Date(date).getDate() + offset);
            }
            const newDue = new Date(card.due);
            newDue.setDate(newDue.getDate() + offset);
            const change = {
                cardId: card.id,
                originalDue: card.due,
                newDue: newDue.toISOString(),
                daysChanged: offset,
            };
            changes.push(change);
            afterDistribution.set(this.formatDate(newDue), ((_b = afterDistribution.get(this.formatDate(newDue))) !== null && _b !== void 0 ? _b : 0) + 1);
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
     * Find days that exceed the limit
     */
    findOverloadedDays(maxCards, days = 30) {
        var _a;
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);
        const distribution = this.cardStore.getDueCardsByDateRange(this.formatDate(today), this.formatDate(endDate));
        // Group by date
        const byDate = new Map();
        for (const card of distribution) {
            const dateStr = this.formatDate(new Date(card.due));
            byDate.set(dateStr, ((_a = byDate.get(dateStr)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        // Find overloaded days
        const overloaded = [];
        for (const [date, count] of byDate) {
            if (count > maxCards) {
                overloaded.push({
                    date,
                    count,
                    excess: count - maxCards,
                });
            }
        }
        return overloaded.sort((a, b) => a.date.localeCompare(b.date));
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
