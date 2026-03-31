/**
 * Schedule Break Service
 *
 * Redistributes cards during a scheduled break (vacation) to prevent
 * workload accumulation.
 */
/**
 * Schedule Break Service
 *
 * When a user schedules a break, cards that would be due during the break
 * are redistributed to before or after the break period.
 */
export class ScheduleBreakService {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    /**
     * Schedule a break and redistribute cards
     */
    scheduleBreak(options) {
        var _a, _b, _c;
        const { startDate, endDate, redistributeBefore = true, redistributeAfter = true, dryRun = true, } = options;
        const breakStart = new Date(startDate);
        const breakEnd = new Date(endDate);
        const cardsInBreak = this.cardStore.getDueCardsByDateRange(startDate, endDate);
        const changes = [];
        const beforeDistribution = new Map();
        const afterDistribution = new Map();
        // Record before distribution
        for (const card of cardsInBreak) {
            const dateStr = this.formatDate(new Date(card.due));
            beforeDistribution.set(dateStr, ((_a = beforeDistribution.get(dateStr)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        if (cardsInBreak.length === 0) {
            return {
                affectedCount: 0,
                beforeDistribution: [],
                afterDistribution: [],
                changes: [],
            };
        }
        // Calculate break duration in days
        const breakDays = this.daysBetween(breakStart, breakEnd) + 1;
        // Determine redistribution strategy
        const redistributionDays = [];
        if (redistributeBefore) {
            // Add days before the break
            for (let i = 1; i <= Math.ceil(breakDays / 2); i++) {
                const day = new Date(breakStart);
                day.setDate(day.getDate() - i);
                redistributionDays.push(day);
            }
        }
        if (redistributeAfter) {
            // Add days after the break
            for (let i = 1; i <= Math.ceil(breakDays / 2); i++) {
                const day = new Date(breakEnd);
                day.setDate(day.getDate() + i);
                redistributionDays.push(day);
            }
        }
        if (redistributionDays.length === 0) {
            // No redistribution - just postpone to after break
            for (const card of cardsInBreak) {
                const newDue = new Date(breakEnd);
                newDue.setDate(newDue.getDate() + 1);
                const change = {
                    cardId: card.id,
                    originalDue: card.due,
                    newDue: newDue.toISOString(),
                    daysChanged: this.daysBetween(new Date(card.due), newDue),
                };
                changes.push(change);
                afterDistribution.set(this.formatDate(newDue), ((_b = afterDistribution.get(this.formatDate(newDue))) !== null && _b !== void 0 ? _b : 0) + 1);
            }
        }
        else {
            // Distribute cards evenly across redistribution days
            const cardsPerDay = Math.ceil(cardsInBreak.length / redistributionDays.length);
            let dayIndex = 0;
            let cardsOnCurrentDay = 0;
            for (const card of cardsInBreak) {
                // Move to next day if current is full
                if (cardsOnCurrentDay >= cardsPerDay &&
                    dayIndex < redistributionDays.length - 1) {
                    dayIndex++;
                    cardsOnCurrentDay = 0;
                }
                const targetDay = redistributionDays[dayIndex];
                if (!targetDay)
                    continue;
                const newDue = new Date(card.due);
                newDue.setFullYear(targetDay.getFullYear());
                newDue.setMonth(targetDay.getMonth());
                newDue.setDate(targetDay.getDate());
                const change = {
                    cardId: card.id,
                    originalDue: card.due,
                    newDue: newDue.toISOString(),
                    daysChanged: this.daysBetween(new Date(card.due), newDue),
                };
                changes.push(change);
                afterDistribution.set(this.formatDate(newDue), ((_c = afterDistribution.get(this.formatDate(newDue))) !== null && _c !== void 0 ? _c : 0) + 1);
                cardsOnCurrentDay++;
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
     * Preview the impact of a break
     */
    previewBreak(startDate, endDate) {
        const cards = this.cardStore.getDueCardsByDateRange(startDate, endDate);
        const breakDays = this.daysBetween(new Date(startDate), new Date(endDate)) + 1;
        return {
            cardsAffected: cards.length,
            breakDays,
        };
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
