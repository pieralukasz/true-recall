/**
 * Easy Days Service
 *
 * Manages reduced workload on specific days (recurring weekdays + specific dates).
 */
export function isEasyDay(date, easyDays) {
    var _a;
    const dayOfWeek = date.getDay();
    const dateStr = (_a = date.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
    if (easyDays.recurringDays.includes(dayOfWeek)) {
        return true;
    }
    if (easyDays.specificDates.includes(dateStr)) {
        return true;
    }
    return false;
}
export class EasyDaysService {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    applyEasyDays(options) {
        var _a, _b, _c;
        const { easyDays, multiplier, targetPerDay, days = 30, dryRun = true, } = options;
        const hasEasyDays = easyDays.recurringDays.length > 0 || easyDays.specificDates.length > 0;
        if (!hasEasyDays) {
            return {
                affectedCount: 0,
                beforeDistribution: [],
                afterDistribution: [],
                changes: [],
            };
        }
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);
        const startDateStr = this.formatDate(today);
        const endDateStr = this.formatDate(endDate);
        // Get all cards in range
        const cards = this.cardStore.getDueCardsByDateRange(startDateStr, endDateStr);
        // Build distribution map
        const distribution = new Map();
        for (const card of cards) {
            const dateStr = this.formatDate(new Date(card.due));
            const existing = (_a = distribution.get(dateStr)) !== null && _a !== void 0 ? _a : [];
            existing.push({ id: card.id, due: card.due });
            distribution.set(dateStr, existing);
        }
        const changes = [];
        const beforeDistribution = new Map();
        const afterDistribution = new Map();
        // Process each day
        const currentDate = new Date(today);
        while (currentDate <= endDate) {
            const dateStr = this.formatDate(currentDate);
            const isEasy = isEasyDay(currentDate, easyDays);
            const cardsOnDay = (_b = distribution.get(dateStr)) !== null && _b !== void 0 ? _b : [];
            beforeDistribution.set(dateStr, cardsOnDay.length);
            if (isEasy && cardsOnDay.length > 0) {
                // Calculate max cards for this easy day
                const maxCards = Math.floor(targetPerDay * multiplier);
                if (cardsOnDay.length > maxCards) {
                    // Need to move excess cards
                    const excess = cardsOnDay.slice(maxCards);
                    for (const card of excess) {
                        // Find next non-easy day
                        const targetDate = this.findNextNonEasyDay(currentDate, easyDays, days);
                        if (targetDate) {
                            const targetDateStr = this.formatDate(targetDate);
                            const newDue = new Date(card.due);
                            newDue.setFullYear(targetDate.getFullYear());
                            newDue.setMonth(targetDate.getMonth());
                            newDue.setDate(targetDate.getDate());
                            const change = {
                                cardId: card.id,
                                originalDue: card.due,
                                newDue: newDue.toISOString(),
                                daysChanged: this.daysBetween(currentDate, targetDate),
                            };
                            changes.push(change);
                            const targetCards = (_c = distribution.get(targetDateStr)) !== null && _c !== void 0 ? _c : [];
                            targetCards.push({ id: card.id, due: newDue.toISOString() });
                            distribution.set(targetDateStr, targetCards);
                        }
                    }
                    afterDistribution.set(dateStr, maxCards);
                }
                else {
                    afterDistribution.set(dateStr, cardsOnDay.length);
                }
            }
            else {
                afterDistribution.set(dateStr, cardsOnDay.length);
            }
            currentDate.setDate(currentDate.getDate() + 1);
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
    findNextNonEasyDay(from, easyDays, maxDays) {
        const candidate = new Date(from);
        candidate.setDate(candidate.getDate() + 1);
        for (let i = 0; i < maxDays; i++) {
            if (!isEasyDay(candidate, easyDays)) {
                return candidate;
            }
            candidate.setDate(candidate.getDate() + 1);
        }
        return null;
    }
    previewImpact(easyDays, multiplier, targetPerDay, days = 30) {
        var _a, _b, _c, _d;
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);
        const startDateStr = this.formatDate(today);
        const endDateStr = this.formatDate(endDate);
        const cards = this.cardStore.getDueCardsByDateRange(startDateStr, endDateStr);
        // Build distribution
        const distribution = new Map();
        for (const card of cards) {
            const dateStr = this.formatDate(new Date(card.due));
            distribution.set(dateStr, ((_a = distribution.get(dateStr)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        let totalMoved = 0;
        const byDay = [];
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const maxCards = Math.floor(targetPerDay * multiplier);
        for (const dayOfWeek of easyDays.recurringDays) {
            const dayName = (_b = dayNames[dayOfWeek]) !== null && _b !== void 0 ? _b : "Unknown";
            let movedForDay = 0;
            const currentDate = new Date(today);
            while (currentDate <= endDate) {
                if (currentDate.getDay() === dayOfWeek) {
                    const dateStr = this.formatDate(currentDate);
                    const count = (_c = distribution.get(dateStr)) !== null && _c !== void 0 ? _c : 0;
                    const excess = Math.max(0, count - maxCards);
                    movedForDay += excess;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            totalMoved += movedForDay;
            byDay.push({ day: dayName, moved: movedForDay });
        }
        for (const dateStr of easyDays.specificDates) {
            const count = (_d = distribution.get(dateStr)) !== null && _d !== void 0 ? _d : 0;
            const excess = Math.max(0, count - maxCards);
            if (excess > 0) {
                totalMoved += excess;
                byDay.push({ day: dateStr, moved: excess });
            }
        }
        return { totalMoved, byDay };
    }
    daysBetween(from, to) {
        const diff = to.getTime() - from.getTime();
        return Math.round(diff / (1000 * 60 * 60 * 24));
    }
    formatDate(date) {
        var _a;
        return (_a = date.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
    }
    mapToDistribution(map) {
        return Array.from(map.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
