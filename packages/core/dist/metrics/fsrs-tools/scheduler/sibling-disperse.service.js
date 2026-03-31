/**
 * Sibling Disperse Service
 *
 * Spreads cards from the same source note to prevent seeing related content
 * too close together in time.
 */
import { State } from "ts-fsrs";
/**
 * Sibling Disperse Service
 *
 * Cards from the same source note are "siblings". This service ensures
 * siblings are spaced apart by a minimum interval to avoid interference.
 */
export class SiblingDisperseService {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    /**
     * Disperse sibling cards
     */
    disperse(options) {
        var _a, _b, _c;
        const { minInterval, sourceUid, dryRun = true } = options;
        const groups = sourceUid
            ? [this.getSiblingGroup(sourceUid)]
            : this.getAllSiblingGroups();
        const changes = [];
        const beforeDistribution = new Map();
        const afterDistribution = new Map();
        for (const group of groups) {
            if (!group || group.cards.length < 2)
                continue;
            // Sort cards by due date
            const sortedCards = [...group.cards].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
            // Track current due dates for before distribution
            for (const card of sortedCards) {
                const dateStr = this.formatDate(new Date(card.due));
                beforeDistribution.set(dateStr, ((_a = beforeDistribution.get(dateStr)) !== null && _a !== void 0 ? _a : 0) + 1);
            }
            // Disperse siblings
            const firstCard = sortedCards[0];
            if (!firstCard)
                continue;
            let previousDue = new Date(firstCard.due);
            afterDistribution.set(this.formatDate(previousDue), ((_b = afterDistribution.get(this.formatDate(previousDue))) !== null && _b !== void 0 ? _b : 0) + 1);
            for (let i = 1; i < sortedCards.length; i++) {
                const card = sortedCards[i];
                if (!card)
                    continue;
                const currentDue = new Date(card.due);
                const daysDiff = this.daysBetween(previousDue, currentDue);
                if (daysDiff < minInterval) {
                    // Need to push this card forward
                    const newDue = new Date(previousDue);
                    newDue.setDate(newDue.getDate() + minInterval);
                    const change = {
                        cardId: card.id,
                        originalDue: card.due,
                        newDue: newDue.toISOString(),
                        daysChanged: minInterval - daysDiff,
                    };
                    changes.push(change);
                    previousDue = newDue;
                }
                else {
                    previousDue = currentDue;
                }
                afterDistribution.set(this.formatDate(previousDue), ((_c = afterDistribution.get(this.formatDate(previousDue))) !== null && _c !== void 0 ? _c : 0) + 1);
            }
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
     * Get sibling group for a specific source UID
     */
    getSiblingGroup(sourceUid) {
        const cards = this.cardStore
            .getCards()
            .filter((c) => c.sourceUid === sourceUid && !c.suspended && c.state !== State.New);
        if (cards.length === 0)
            return null;
        return {
            sourceUid,
            cards: cards.map((c) => ({
                id: c.id,
                due: c.due,
                scheduledDays: c.scheduledDays,
            })),
        };
    }
    /**
     * Get all sibling groups (groups with more than 1 card)
     */
    getAllSiblingGroups() {
        const cards = this.cardStore
            .getCards()
            .filter((c) => c.sourceUid && !c.suspended && c.state !== State.New);
        // Group by source UID
        const groups = new Map();
        for (const card of cards) {
            if (!card.sourceUid)
                continue;
            const existing = groups.get(card.sourceUid);
            if (existing) {
                existing.cards.push({
                    id: card.id,
                    due: card.due,
                    scheduledDays: card.scheduledDays,
                });
            }
            else {
                groups.set(card.sourceUid, {
                    sourceUid: card.sourceUid,
                    cards: [
                        {
                            id: card.id,
                            due: card.due,
                            scheduledDays: card.scheduledDays,
                        },
                    ],
                });
            }
        }
        return Array.from(groups.values()).filter((g) => g.cards.length > 1);
    }
    /**
     * Find sibling pairs that violate the minimum interval
     */
    findViolations(minInterval) {
        var _a;
        const groups = this.cardStore
            .getCards()
            .filter((c) => c.sourceUid && !c.suspended && c.state !== State.New);
        // Group by source UID
        const bySource = new Map();
        for (const card of groups) {
            if (!card.sourceUid)
                continue;
            const existing = (_a = bySource.get(card.sourceUid)) !== null && _a !== void 0 ? _a : [];
            existing.push({ id: card.id, due: card.due });
            bySource.set(card.sourceUid, existing);
        }
        // Check violations
        const results = [];
        for (const [sourceUid, cards] of bySource) {
            if (cards.length < 2)
                continue;
            // Sort by due date
            cards.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
            let violations = 0;
            for (let i = 1; i < cards.length; i++) {
                const prevCard = cards[i - 1];
                const currCard = cards[i];
                if (!prevCard || !currCard)
                    continue;
                const prev = new Date(prevCard.due);
                const curr = new Date(currCard.due);
                if (this.daysBetween(prev, curr) < minInterval) {
                    violations++;
                }
            }
            if (violations > 0) {
                results.push({
                    sourceUid,
                    cardCount: cards.length,
                    violations,
                });
            }
        }
        return results;
    }
    /**
     * Calculate days between two dates
     */
    daysBetween(from, to) {
        const diff = to.getTime() - from.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
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
