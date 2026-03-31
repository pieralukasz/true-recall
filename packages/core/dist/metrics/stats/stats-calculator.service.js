import { State } from "ts-fsrs";
import { formatLocalDate, getTodayBoundary, getTomorrowBoundary, } from "../../utils";
import { ChartDataCalculator, MaturityCalculator, StreakCalculator, } from "./calculators";
import { EMPTY_FILTER } from "./stats-filter.types";
export class StatsCalculatorService {
    constructor(fsrsService, flashcardManager, sessionPersistence, dayStartHour) {
        this.flashcardManager = flashcardManager;
        this.sqliteStore = null;
        this.dayStartHour = 4;
        this.filter = EMPTY_FILTER;
        this.filterCacheKey = this.buildFilterCacheKey(EMPTY_FILTER);
        this.cardSnapshot = null;
        this.filteredCardsCache = null;
        this.dailyStatsCache = new Map();
        this.dailyStatsRangeCache = new Map();
        this.healthCache = null;
        // Specialized calculators
        this.streakCalculator = new StreakCalculator();
        this.maturityCalculator = new MaturityCalculator();
        this.chartDataCalculator = new ChartDataCalculator();
        this.sessionPersistence = sessionPersistence;
        this.fsrsService = fsrsService;
        if (dayStartHour !== undefined)
            this.dayStartHour = dayStartHour;
    }
    setSqliteStore(store) {
        this.sqliteStore = store;
        this.maturityCalculator.setSqliteStore(store);
        this.chartDataCalculator.setSqliteStore(store);
    }
    setDayStartHour(hour) {
        this.dayStartHour = hour;
    }
    setFilter(ctx) {
        this.filter = ctx;
        const nextKey = this.buildFilterCacheKey(ctx);
        if (nextKey === this.filterCacheKey)
            return;
        this.filterCacheKey = nextKey;
        this.filteredCardsCache = null;
        this.clearDailyStatsCaches();
    }
    setCardSnapshot(cards) {
        if (this.cardSnapshot === cards)
            return;
        this.cardSnapshot = cards;
        this.filteredCardsCache = null;
        this.clearDailyStatsCaches();
    }
    get isFilterActive() {
        return (this.filter.archivedSourceUids.size > 0 ||
            this.filter.presetNames !== null);
    }
    getFilteredCards() {
        var _a;
        const sourceCards = (_a = this.cardSnapshot) !== null && _a !== void 0 ? _a : this.flashcardManager.getAllFSRSCards();
        const cached = this.filteredCardsCache;
        if (cached &&
            cached.filterKey === this.filterCacheKey &&
            cached.source === sourceCards) {
            return cached.result;
        }
        if (!this.isFilterActive) {
            this.filteredCardsCache = {
                filterKey: this.filterCacheKey,
                source: sourceCards,
                result: sourceCards,
            };
            return sourceCards;
        }
        let cards = sourceCards;
        if (this.filter.archivedSourceUids.size > 0) {
            cards = cards.filter((c) => !c.sourceUid || !this.filter.archivedSourceUids.has(c.sourceUid));
        }
        if (this.filter.presetSourceUids) {
            cards = cards.filter((c) => {
                var _a;
                return c.sourceUid !== undefined &&
                    ((_a = this.filter.presetSourceUids) === null || _a === void 0 ? void 0 : _a.has(c.sourceUid));
            });
        }
        this.filteredCardsCache = {
            filterKey: this.filterCacheKey,
            source: sourceCards,
            result: cards,
        };
        return cards;
    }
    getFilteredDailyStats() {
        const todayKey = formatLocalDate(getTodayBoundary(this.dayStartHour));
        const cacheKey = `all:${todayKey}:${this.filterCacheKey}`;
        const cached = this.dailyStatsCache.get(cacheKey);
        if (cached)
            return cached;
        if (this.dailyStatsCache.size >= 20) {
            const oldest = this.dailyStatsCache.keys().next().value;
            if (oldest !== undefined)
                this.dailyStatsCache.delete(oldest);
        }
        let result;
        if (!this.isFilterActive) {
            result = this.sessionPersistence.getAllDailyStatsSummary();
        }
        else if (!this.sqliteStore) {
            result = {};
        }
        else {
            const rows = this.sqliteStore.stats.getDailyStatsFromReviewLog("1970-01-01", todayKey, {
                presetNames: this.filter.presetNames
                    ? [...this.filter.presetNames]
                    : undefined,
                excludeSourceUids: [...this.filter.archivedSourceUids],
            });
            result = {};
            for (const row of rows) {
                result[row.date] = row;
            }
        }
        this.dailyStatsCache.set(cacheKey, result);
        return result;
    }
    getFilteredDailyStatsInRange(startKey, endKey) {
        const cacheKey = `${startKey}:${endKey}:${this.filterCacheKey}`;
        const cached = this.dailyStatsRangeCache.get(cacheKey);
        if (cached)
            return cached;
        if (this.dailyStatsRangeCache.size >= 20) {
            const oldest = this.dailyStatsRangeCache.keys().next().value;
            if (oldest !== undefined)
                this.dailyStatsRangeCache.delete(oldest);
        }
        let result;
        if (!this.isFilterActive) {
            result = this.sessionPersistence.getStatsInRange(startKey, endKey);
        }
        else {
            // Derive from full-history cache instead of a separate DB query
            const fullHistory = this.getFilteredDailyStats();
            result = [];
            for (const [date, stats] of Object.entries(fullHistory)) {
                if (date >= startKey && date <= endKey)
                    result.push(stats);
            }
            result.sort((a, b) => a.date.localeCompare(b.date));
        }
        this.dailyStatsRangeCache.set(cacheKey, result);
        return result;
    }
    getAllDailyStats() {
        return this.getFilteredDailyStats();
    }
    getCardMaturityBreakdown() {
        const cards = this.getFilteredCards();
        return this.maturityCalculator.calculate(cards);
    }
    getFutureDueStats(range) {
        const cards = this.getFilteredCards();
        return this.chartDataCalculator.getFutureDueStats(cards, range);
    }
    getReviewHistory(range) {
        return this.getReviewHistorySync(range);
    }
    getReviewHistorySync(range) {
        var _a, _b;
        const endDate = new Date();
        const startDate = this.calculateStartDate(endDate, range);
        const startKey = (_a = startDate.toISOString().split("T")[0]) !== null && _a !== void 0 ? _a : "";
        const endKey = (_b = endDate.toISOString().split("T")[0]) !== null && _b !== void 0 ? _b : "";
        return this.getFilteredDailyStatsInRange(startKey, endKey);
    }
    getTodaySummary() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        if (this.isFilterActive) {
            const today = formatLocalDate(getTodayBoundary(this.dayStartHour));
            const todayStats = this.getFilteredDailyStats()[today];
            if (!todayStats)
                return emptyTodaySummary();
            const totalRatings = ((_a = todayStats.again) !== null && _a !== void 0 ? _a : 0) +
                ((_b = todayStats.hard) !== null && _b !== void 0 ? _b : 0) +
                ((_c = todayStats.good) !== null && _c !== void 0 ? _c : 0) +
                ((_d = todayStats.easy) !== null && _d !== void 0 ? _d : 0);
            const correctReviews = ((_e = todayStats.good) !== null && _e !== void 0 ? _e : 0) + ((_f = todayStats.easy) !== null && _f !== void 0 ? _f : 0);
            return {
                studied: todayStats.reviewsCompleted,
                minutes: Math.round(todayStats.totalTimeMs / 60000),
                newCards: todayStats.newCardsStudied,
                reviewCards: (_g = todayStats.reviewCards) !== null && _g !== void 0 ? _g : 0,
                again: (_h = todayStats.again) !== null && _h !== void 0 ? _h : 0,
                correctRate: totalRatings > 0 ? correctReviews / totalRatings : 0,
            };
        }
        const todayStats = this.sessionPersistence.getTodayStats();
        const totalRatings = ((_j = todayStats.again) !== null && _j !== void 0 ? _j : 0) +
            ((_k = todayStats.hard) !== null && _k !== void 0 ? _k : 0) +
            ((_l = todayStats.good) !== null && _l !== void 0 ? _l : 0) +
            ((_m = todayStats.easy) !== null && _m !== void 0 ? _m : 0);
        const correctReviews = ((_o = todayStats.good) !== null && _o !== void 0 ? _o : 0) + ((_p = todayStats.easy) !== null && _p !== void 0 ? _p : 0);
        return {
            studied: todayStats.reviewsCompleted,
            minutes: Math.round(todayStats.totalTimeMs / 60000),
            newCards: todayStats.newCardsStudied,
            reviewCards: (_q = todayStats.reviewCards) !== null && _q !== void 0 ? _q : 0,
            again: (_r = todayStats.again) !== null && _r !== void 0 ? _r : 0,
            correctRate: totalRatings > 0 ? correctReviews / totalRatings : 0,
        };
    }
    getStreakInfo() {
        const allStats = this.getFilteredDailyStats();
        return this.streakCalculator.calculate(allStats, this.dayStartHour);
    }
    getRangeSummary(range) {
        return this.getRangeSummarySync(range);
    }
    getRangeSummarySync(range) {
        const history = this.getReviewHistorySync(range);
        const cards = this.getFilteredCards();
        const endDate = new Date();
        const startDate = this.calculateStartDate(endDate, range);
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysStudied = history.filter((d) => d.reviewsCompleted > 0).length;
        const totalReviews = history.reduce((sum, d) => sum + d.reviewsCompleted, 0);
        const tomorrowStart = getTomorrowBoundary(this.dayStartHour);
        const dayAfterTomorrow = new Date(tomorrowStart);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
        const dueTomorrow = cards.filter((c) => {
            if (c.fsrs.state === State.New)
                return false;
            const dueDate = new Date(c.fsrs.due);
            return dueDate >= tomorrowStart && dueDate < dayAfterTomorrow;
        }).length;
        const futureStats = this.getFutureDueStats("1m");
        const dailyLoad = futureStats.length > 0
            ? Math.round(futureStats.reduce((sum, d) => sum + d.count, 0) /
                Math.max(futureStats.length, 1))
            : 0;
        return {
            daysStudied,
            totalDays,
            totalReviews,
            avgPerDay: totalDays > 0 ? Math.round(totalReviews / totalDays) : 0,
            avgForStudiedDays: daysStudied > 0 ? Math.round(totalReviews / daysStudied) : 0,
            dueTomorrow,
            dailyLoad,
        };
    }
    getRatingDistributionHistory(range) {
        const allStats = this.getFilteredDailyStats();
        return this.chartDataCalculator.getRatingDistributionHistory(allStats, range);
    }
    getCollectionHealthSnapshot() {
        const filteredCards = this.getFilteredCards();
        const minuteBucket = Math.floor(Date.now() / 60000);
        if (this.healthCache &&
            this.healthCache.filterKey === this.filterCacheKey &&
            this.healthCache.source === filteredCards &&
            this.healthCache.minuteBucket === minuteBucket) {
            return this.healthCache.result;
        }
        const allCards = filteredCards.filter((c) => c.fsrs.state !== State.New && !c.fsrs.suspended);
        if (allCards.length === 0) {
            const result = {
                averageRetention: 0,
                distribution: buildHealthBuckets([]),
                cardCount: 0,
            };
            this.healthCache = {
                filterKey: this.filterCacheKey,
                source: filteredCards,
                minuteBucket,
                result,
            };
            return result;
        }
        const now = new Date();
        const retrievabilities = allCards.map((c) => this.fsrsService.getRetrievability(c.fsrs, now));
        const avg = retrievabilities.reduce((s, r) => s + r, 0) / retrievabilities.length;
        const result = {
            averageRetention: Math.round(avg * 100),
            distribution: buildHealthBuckets(retrievabilities),
            cardCount: allCards.length,
        };
        this.healthCache = {
            filterKey: this.filterCacheKey,
            source: filteredCards,
            minuteBucket,
            result,
        };
        return result;
    }
    getNotePerformance() {
        if (this.sqliteStore) {
            if (this.isFilterActive) {
                return this.sqliteStore.stats.getNotePerformanceFiltered([...this.filter.archivedSourceUids], this.filter.presetSourceUids
                    ? [...this.filter.presetSourceUids]
                    : undefined);
            }
            return this.sqliteStore.stats.getNotePerformance();
        }
        return [];
    }
    getRetentionHistory(range) {
        const allStats = this.getFilteredDailyStats();
        return this.chartDataCalculator.getRetentionHistory(allStats, range);
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
    getFutureDueStatsFilled(range) {
        const cards = this.getFilteredCards();
        return this.chartDataCalculator.getFutureDueStatsFilled(cards, range);
    }
    getCardsDueOnDate(date) {
        const cards = this.getFilteredCards();
        return this.chartDataCalculator.getCardsDueOnDate(cards, date);
    }
    getCardsByCategory(category) {
        const cards = this.getFilteredCards();
        return this.maturityCalculator.getCardsByCategory(cards, category);
    }
    getCardsCreatedHistoryFilled(range) {
        return this.getCardsCreatedHistoryFilledSync(range);
    }
    getCardsCreatedHistoryFilledSync(range) {
        const cards = this.getFilteredCards();
        return this.chartDataCalculator.getCardsCreatedHistoryFilledSync(cards, range);
    }
    getCardsCreatedOnDate(date) {
        const cards = this.getFilteredCards();
        return this.chartDataCalculator.getCardsCreatedOnDate(cards, date);
    }
    clearDailyStatsCaches() {
        this.dailyStatsCache.clear();
        this.dailyStatsRangeCache.clear();
        this.healthCache = null;
    }
    buildFilterCacheKey(ctx) {
        const archived = [...ctx.archivedSourceUids].sort().join("|");
        const presetNames = ctx.presetNames
            ? [...ctx.presetNames].sort().join("|")
            : "";
        const presetSourceUids = ctx.presetSourceUids
            ? [...ctx.presetSourceUids].sort().join("|")
            : "";
        return `a:${archived};pn:${presetNames};ps:${presetSourceUids}`;
    }
}
const HEALTH_BUCKETS = [
    { label: "At risk (<50%)", threshold: 0.5, colorVar: "--color-red" },
    { label: "Low (50-70%)", threshold: 0.7, colorVar: "--color-orange" },
    { label: "Medium (70-85%)", threshold: 0.85, colorVar: "--color-yellow" },
    { label: "High (85-95%)", threshold: 0.95, colorVar: "--color-green" },
    { label: "Strong (>95%)", threshold: 1, colorVar: "--color-cyan" },
];
function buildHealthBuckets(retrievabilities) {
    var _a;
    const counts = new Map(HEALTH_BUCKETS.map((_, i) => [i, 0]));
    for (const r of retrievabilities) {
        const idx = HEALTH_BUCKETS.findIndex((b) => r < b.threshold);
        const bucketIdx = idx === -1 ? HEALTH_BUCKETS.length - 1 : idx;
        counts.set(bucketIdx, ((_a = counts.get(bucketIdx)) !== null && _a !== void 0 ? _a : 0) + 1);
    }
    return HEALTH_BUCKETS.map((b, i) => {
        var _a;
        return ({
            label: b.label,
            count: (_a = counts.get(i)) !== null && _a !== void 0 ? _a : 0,
            colorVar: b.colorVar,
        });
    });
}
function emptyTodaySummary() {
    return {
        studied: 0,
        minutes: 0,
        newCards: 0,
        reviewCards: 0,
        again: 0,
        correctRate: 0,
    };
}
