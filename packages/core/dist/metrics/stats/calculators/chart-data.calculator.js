import { State } from "ts-fsrs";
import { formatLocalDate } from "../../../utils";
export class ChartDataCalculator {
    constructor(sqliteStore = null) {
        this.sqliteStore = sqliteStore;
    }
    setSqliteStore(store) {
        this.sqliteStore = store;
    }
    getFutureDueStats(allCards, range) {
        var _a;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = this.calculateEndDate(today, range);
        // Group cards by due date
        const dueMap = new Map();
        for (const card of allCards) {
            // Skip new cards (they're not "due" in the traditional sense)
            if (card.fsrs.state === State.New)
                continue;
            const dueDate = new Date(card.fsrs.due);
            dueDate.setHours(0, 0, 0, 0);
            // For 'backlog', only include past due cards
            if (range === "backlog" && dueDate >= today)
                continue;
            // For other ranges, include up to end date
            if (range !== "backlog" && dueDate > endDate)
                continue;
            const dateKey = formatLocalDate(dueDate);
            dueMap.set(dateKey, ((_a = dueMap.get(dateKey)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        // Convert to sorted array with cumulative
        const entries = Array.from(dueMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
        let cumulative = 0;
        return entries.map((entry) => {
            cumulative += entry.count;
            return {
                date: entry.date,
                count: entry.count,
                cumulative,
            };
        });
    }
    getFutureDueStatsFilled(allCards, range) {
        var _a;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = this.calculateEndDate(today, range);
        // For backlog, return the existing sparse data
        if (range === "backlog") {
            return this.getFutureDueStats(allCards, range);
        }
        // Generate all days in range
        const dueMap = new Map();
        const currentDate = new Date(today);
        while (currentDate <= endDate) {
            const dateKey = formatLocalDate(currentDate);
            dueMap.set(dateKey, 0);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Count cards for each day
        for (const card of allCards) {
            if (card.fsrs.state === State.New || card.fsrs.suspended)
                continue;
            const dueDate = new Date(card.fsrs.due);
            dueDate.setHours(0, 0, 0, 0);
            const dateKey = formatLocalDate(dueDate);
            if (dueMap.has(dateKey)) {
                const currentCount = (_a = dueMap.get(dateKey)) !== null && _a !== void 0 ? _a : 0;
                dueMap.set(dateKey, currentCount + 1);
            }
        }
        // Convert to sorted array with cumulative
        const entries = Array.from(dueMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
        let cumulative = 0;
        return entries.map((entry) => {
            cumulative += entry.count;
            return {
                date: entry.date,
                count: entry.count,
                cumulative,
            };
        });
    }
    getCardsCreatedHistoryFilled(allCards, range) {
        return this.getCardsCreatedHistoryFilledSync(allCards, range);
    }
    getCardsCreatedHistoryFilledSync(allCards, range) {
        var _a;
        if (range === "backlog") {
            return [];
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = this.calculateStartDate(today, range);
        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(today);
        // Generate all days in range, initialized to 0
        const createdMap = new Map();
        const currentDate = new Date(startDate);
        while (currentDate <= today) {
            const dateKey = formatLocalDate(currentDate);
            createdMap.set(dateKey, 0);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        if (this.sqliteStore) {
            const rawData = this.sqliteStore.stats.getCardsCreatedByDate(startDateStr, endDateStr);
            for (const entry of rawData) {
                if (createdMap.has(entry.date)) {
                    createdMap.set(entry.date, entry.count);
                }
            }
        }
        else {
            // Fallback: iterate all cards (less efficient)
            for (const card of allCards) {
                if (!card.fsrs.createdAt)
                    continue;
                const createdDate = new Date(card.fsrs.createdAt);
                createdDate.setHours(0, 0, 0, 0);
                const dateKey = formatLocalDate(createdDate);
                if (createdMap.has(dateKey)) {
                    createdMap.set(dateKey, ((_a = createdMap.get(dateKey)) !== null && _a !== void 0 ? _a : 0) + 1);
                }
            }
        }
        // Convert to sorted array with cumulative
        const entries = Array.from(createdMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
        let cumulative = 0;
        return entries.map((entry) => {
            cumulative += entry.count;
            return {
                date: entry.date,
                count: entry.count,
                cumulative,
            };
        });
    }
    getRatingDistributionHistory(allStats, range) {
        var _a, _b, _c, _d;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = this.calculateStartDate(today, range);
        const startDateStr = formatLocalDate(startDate);
        const todayStr = formatLocalDate(today);
        const entries = [];
        for (const [date, stats] of Object.entries(allStats)) {
            if (date < startDateStr || date > todayStr)
                continue;
            const again = (_a = stats.again) !== null && _a !== void 0 ? _a : 0;
            const hard = (_b = stats.hard) !== null && _b !== void 0 ? _b : 0;
            const good = (_c = stats.good) !== null && _c !== void 0 ? _c : 0;
            const easy = (_d = stats.easy) !== null && _d !== void 0 ? _d : 0;
            const total = again + hard + good + easy;
            if (total === 0)
                continue;
            entries.push({ date, again, hard, good, easy, total });
        }
        return entries.sort((a, b) => a.date.localeCompare(b.date));
    }
    getRetentionHistory(allStats, range) {
        var _a, _b, _c, _d;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = this.calculateStartDate(today, range);
        const startDateStr = formatLocalDate(startDate);
        const todayStr = formatLocalDate(today);
        const entries = [];
        for (const [date, stats] of Object.entries(allStats)) {
            // Filter by date range
            if (date < startDateStr || date > todayStr)
                continue;
            // Calculate total reviews with rating breakdown
            const again = (_a = stats.again) !== null && _a !== void 0 ? _a : 0;
            const hard = (_b = stats.hard) !== null && _b !== void 0 ? _b : 0;
            const good = (_c = stats.good) !== null && _c !== void 0 ? _c : 0;
            const easy = (_d = stats.easy) !== null && _d !== void 0 ? _d : 0;
            const total = again + hard + good + easy;
            if (total === 0)
                continue;
            // Retention = correct answers (good + easy) / total
            const correct = good + easy;
            const retention = Math.round((correct / total) * 100);
            entries.push({ date, retention, total });
        }
        return entries.sort((a, b) => a.date.localeCompare(b.date));
    }
    getCardsCreatedVsReviewedHistory(range) {
        if (range === "backlog") {
            return [];
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = this.calculateStartDate(today, range);
        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(today);
        if (this.sqliteStore) {
            return this.sqliteStore.stats.getCardsCreatedVsReviewed(startDateStr, endDateStr);
        }
        // Fallback: return empty (would need complex iteration without SQLite)
        return [];
    }
    getCardsDueOnDate(allCards, date) {
        // Parse date as local (not UTC)
        const parts = date.split("-").map(Number);
        const [year, month, day] = parts;
        if (year === undefined || month === undefined || day === undefined) {
            throw new Error(`Invalid date format: ${date}`);
        }
        const targetDate = new Date(year, month - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        return allCards.filter((card) => {
            if (card.fsrs.state === State.New || card.fsrs.suspended)
                return false;
            const dueDate = new Date(card.fsrs.due);
            dueDate.setHours(0, 0, 0, 0);
            return dueDate.toDateString() === targetDate.toDateString();
        });
    }
    getCardsCreatedOnDate(allCards, date) {
        if (this.sqliteStore) {
            const cardIds = this.sqliteStore.stats.getCardsCreatedOnDate(date);
            const cardMap = new Map(allCards.map((c) => [c.id, c]));
            return cardIds
                .map((id) => cardMap.get(id))
                .filter((c) => c !== undefined);
        }
        // Fallback: filter all cards
        const parts = date.split("-").map(Number);
        const [year, month, day] = parts;
        if (year === undefined || month === undefined || day === undefined) {
            throw new Error(`Invalid date format: ${date}`);
        }
        const targetDate = new Date(year, month - 1, day);
        targetDate.setHours(0, 0, 0, 0);
        return allCards.filter((card) => {
            if (!card.fsrs.createdAt)
                return false;
            const createdDate = new Date(card.fsrs.createdAt);
            createdDate.setHours(0, 0, 0, 0);
            return createdDate.toDateString() === targetDate.toDateString();
        });
    }
    calculateEndDate(today, range) {
        const endDate = new Date(today);
        switch (range) {
            case "backlog":
                endDate.setDate(endDate.getDate() - 1);
                break;
            case "1m":
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case "3m":
                endDate.setMonth(endDate.getMonth() + 3);
                break;
            case "1y":
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
            case "all":
                endDate.setFullYear(endDate.getFullYear() + 10);
                break;
        }
        return endDate;
    }
    calculateStartDate(today, range) {
        const startDate = new Date(today);
        switch (range) {
            case "backlog":
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case "1m":
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case "3m":
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case "1y":
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            case "all":
                startDate.setFullYear(startDate.getFullYear() - 10);
                break;
        }
        return startDate;
    }
}
