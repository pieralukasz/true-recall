/**
 * Load Balance Service
 *
 * Distributes reviews evenly across days to prevent workload spikes.
 */
import { isEasyDay } from "./easy-days.service";
export class LoadBalanceService {
    constructor(cardStore) {
        this.cardStore = cardStore;
    }
    balance(options) {
        var _a, _b, _c, _d;
        const { targetPerDay, maxDeviation, days = 30, easyDays = { recurringDays: [], specificDates: [] }, easyDaysMultiplier = 0.5, dryRun = true, } = options;
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);
        const startDateStr = this.formatDate(today);
        const endDateStr = this.formatDate(endDate);
        const dueCards = this.cardStore.getDueCardsByDateRange(startDateStr, endDateStr);
        // Build distribution map
        const distribution = new Map();
        for (const card of dueCards) {
            const dateStr = this.formatDate(new Date(card.due));
            const existing = (_a = distribution.get(dateStr)) !== null && _a !== void 0 ? _a : [];
            existing.push(card);
            distribution.set(dateStr, existing);
        }
        // Calculate target for each day (considering easy days)
        const dailyTargets = new Map();
        const currentDate = new Date(today);
        while (currentDate <= endDate) {
            const dateStr = this.formatDate(currentDate);
            const isEasy = isEasyDay(currentDate, easyDays);
            const target = isEasy
                ? Math.round(targetPerDay * easyDaysMultiplier)
                : targetPerDay;
            dailyTargets.set(dateStr, target);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Record before distribution
        const beforeDistribution = [];
        for (const [date, cards] of distribution) {
            beforeDistribution.push({ date, count: cards.length });
        }
        beforeDistribution.sort((a, b) => a.date.localeCompare(b.date));
        // Balance algorithm
        const changes = [];
        const maxDev = targetPerDay * (maxDeviation / 100);
        // Find overloaded days and redistribute
        for (const [date, cards] of distribution) {
            const target = (_b = dailyTargets.get(date)) !== null && _b !== void 0 ? _b : targetPerDay;
            const threshold = target + maxDev;
            if (cards.length > threshold) {
                // This day is overloaded - move excess cards
                const excess = cards.slice(Math.floor(threshold));
                for (const card of excess) {
                    // Find best day to move to
                    const newDate = this.findBestDay(date, distribution, dailyTargets, maxDev, days);
                    if (newDate && newDate !== date) {
                        const change = {
                            cardId: card.id,
                            originalDue: card.due,
                            newDue: `${newDate}T${card.due.split("T")[1]}`,
                            daysChanged: this.daysDiff(date, newDate),
                        };
                        changes.push(change);
                        const fromCards = (_c = distribution.get(date)) !== null && _c !== void 0 ? _c : [];
                        const idx = fromCards.findIndex((c) => c.id === card.id);
                        if (idx >= 0)
                            fromCards.splice(idx, 1);
                        const toCards = (_d = distribution.get(newDate)) !== null && _d !== void 0 ? _d : [];
                        toCards.push(Object.assign(Object.assign({}, card), { due: change.newDue }));
                        distribution.set(newDate, toCards);
                    }
                }
            }
        }
        // Apply changes if not dry run
        if (!dryRun) {
            for (const change of changes) {
                this.cardStore.updateCardDue(change.cardId, change.newDue);
            }
        }
        // Build after distribution
        const afterDistribution = [];
        for (const [date, cards] of distribution) {
            afterDistribution.push({ date, count: cards.length });
        }
        afterDistribution.sort((a, b) => a.date.localeCompare(b.date));
        return {
            affectedCount: changes.length,
            beforeDistribution,
            afterDistribution,
            changes,
        };
    }
    findBestDay(fromDate, distribution, targets, maxDev, maxDays) {
        var _a, _b, _c;
        let bestDate = null;
        let bestScore = Infinity;
        // Look for days with room (prefer later days to maintain spacing)
        const fromDateObj = new Date(fromDate);
        for (let offset = 1; offset <= maxDays; offset++) {
            const candidateDate = new Date(fromDateObj);
            candidateDate.setDate(candidateDate.getDate() + offset);
            const dateStr = this.formatDate(candidateDate);
            const currentCount = (_b = (_a = distribution.get(dateStr)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
            const target = (_c = targets.get(dateStr)) !== null && _c !== void 0 ? _c : 100;
            const threshold = target + maxDev;
            if (currentCount < threshold) {
                // Calculate score (prefer closer dates and emptier days)
                const fillRatio = currentCount / target;
                const score = offset * 0.5 + fillRatio * 10;
                if (score < bestScore) {
                    bestScore = score;
                    bestDate = dateStr;
                }
            }
        }
        return bestDate;
    }
    formatDate(date) {
        var _a;
        return (_a = date.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
    }
    daysDiff(from, to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    getDistribution(days) {
        var _a, _b;
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);
        const startDateStr = this.formatDate(today);
        const endDateStr = this.formatDate(endDate);
        const dueCards = this.cardStore.getDueCardsByDateRange(startDateStr, endDateStr);
        // Build distribution map
        const distribution = new Map();
        for (const card of dueCards) {
            const dateStr = this.formatDate(new Date(card.due));
            distribution.set(dateStr, ((_a = distribution.get(dateStr)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        // Convert to array
        const result = [];
        const currentDate = new Date(today);
        while (currentDate <= endDate) {
            const dateStr = this.formatDate(currentDate);
            result.push({
                date: dateStr,
                count: (_b = distribution.get(dateStr)) !== null && _b !== void 0 ? _b : 0,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return result;
    }
}
