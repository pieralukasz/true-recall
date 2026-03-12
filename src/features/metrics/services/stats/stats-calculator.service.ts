import type { SessionPersistenceService } from "@features/core/persistence/session-persistence.service";
import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import type { FSRSService } from "@features/core/services/fsrs.service";
import {
	ChartDataCalculator,
	MaturityCalculator,
	StreakCalculator,
	type StreakInfo,
} from "@features/metrics/services/stats/calculators";
import {
	EMPTY_FILTER,
	type StatsFilterContext,
} from "@features/metrics/services/stats/stats-filter.types";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type {
	CardMaturityBreakdown,
	CardsCreatedEntry,
	CollectionHealthSnapshot,
	ExtendedDailyStats,
	FSRSFlashcardItem,
	FutureDueEntry,
	HealthBucket,
	NotePerformanceRow,
	RatingDistributionEntry,
	RetentionEntry,
	StatsTimeRange,
	TodaySummary,
} from "@shared/types";
import { State } from "ts-fsrs";

export class StatsCalculatorService {
	private sessionPersistence: SessionPersistenceService;
	private fsrsService: FSRSService;
	private sqliteStore: SqliteStoreService | null = null;
	private filter: StatsFilterContext = EMPTY_FILTER;
	private filterCacheKey = this.buildFilterCacheKey(EMPTY_FILTER);
	private cardSnapshot: FSRSFlashcardItem[] | null = null;
	private filteredCardsCache: {
		filterKey: string;
		source: FSRSFlashcardItem[];
		result: FSRSFlashcardItem[];
	} | null = null;
	private dailyStatsCache = new Map<
		string,
		Record<string, ExtendedDailyStats>
	>();
	private dailyStatsRangeCache = new Map<string, ExtendedDailyStats[]>();
	private healthCache: {
		filterKey: string;
		source: FSRSFlashcardItem[];
		minuteBucket: number;
		result: CollectionHealthSnapshot;
	} | null = null;

	// Specialized calculators
	private streakCalculator = new StreakCalculator();
	private maturityCalculator = new MaturityCalculator();
	private chartDataCalculator = new ChartDataCalculator();

	constructor(
		fsrsService: FSRSService,
		private flashcardManager: FlashcardManager,
		sessionPersistence: SessionPersistenceService,
	) {
		this.sessionPersistence = sessionPersistence;
		this.fsrsService = fsrsService;
	}

	setSqliteStore(store: SqliteStoreService): void {
		this.sqliteStore = store;
		this.maturityCalculator.setSqliteStore(store);
		this.chartDataCalculator.setSqliteStore(store);
	}

	setFilter(ctx: StatsFilterContext): void {
		this.filter = ctx;
		const nextKey = this.buildFilterCacheKey(ctx);
		if (nextKey === this.filterCacheKey) return;
		this.filterCacheKey = nextKey;
		this.filteredCardsCache = null;
		this.clearDailyStatsCaches();
	}

	setCardSnapshot(cards: FSRSFlashcardItem[]): void {
		if (this.cardSnapshot === cards) return;
		this.cardSnapshot = cards;
		this.filteredCardsCache = null;
		this.clearDailyStatsCaches();
	}

	private get isFilterActive(): boolean {
		return (
			this.filter.archivedSourceUids.size > 0 ||
			this.filter.presetNames !== null
		);
	}

	private getFilteredCards(): FSRSFlashcardItem[] {
		const sourceCards =
			this.cardSnapshot ?? this.flashcardManager.getAllFSRSCards();
		const cached = this.filteredCardsCache;
		if (
			cached &&
			cached.filterKey === this.filterCacheKey &&
			cached.source === sourceCards
		) {
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
			cards = cards.filter(
				(c) => !c.sourceUid || !this.filter.archivedSourceUids.has(c.sourceUid),
			);
		}

		if (this.filter.presetSourceUids) {
			cards = cards.filter(
				(c) =>
					c.sourceUid !== undefined &&
					this.filter.presetSourceUids?.has(c.sourceUid),
			);
		}

		this.filteredCardsCache = {
			filterKey: this.filterCacheKey,
			source: sourceCards,
			result: cards,
		};

		return cards;
	}

	/**
	 * Get filtered daily stats from review_log when filters are active,
	 * otherwise use the fast daily_stats table path.
	 */
	private getFilteredDailyStats(): Record<string, ExtendedDailyStats> {
		const todayKey = new Date().toISOString().split("T")[0] ?? "";
		const cacheKey = `all:${todayKey}:${this.filterCacheKey}`;
		const cached = this.dailyStatsCache.get(cacheKey);
		if (cached) return cached;

		if (this.dailyStatsCache.size >= 20) {
			const oldest = this.dailyStatsCache.keys().next().value;
			if (oldest !== undefined) this.dailyStatsCache.delete(oldest);
		}

		let result: Record<string, ExtendedDailyStats>;
		if (!this.isFilterActive) {
			result = this.sessionPersistence.getAllDailyStatsSummary();
		} else if (!this.sqliteStore) {
			result = {};
		} else {
			const rows = this.sqliteStore.stats.getDailyStatsFromReviewLog(
				"1970-01-01",
				todayKey,
				{
					presetNames: this.filter.presetNames
						? [...this.filter.presetNames]
						: undefined,
					excludeSourceUids: [...this.filter.archivedSourceUids],
				},
			);

			result = {};
			for (const row of rows) {
				result[row.date] = row;
			}
		}

		this.dailyStatsCache.set(cacheKey, result);
		return result;
	}

	private getFilteredDailyStatsInRange(
		startKey: string,
		endKey: string,
	): ExtendedDailyStats[] {
		const cacheKey = `${startKey}:${endKey}:${this.filterCacheKey}`;
		const cached = this.dailyStatsRangeCache.get(cacheKey);
		if (cached) return cached;

		if (this.dailyStatsRangeCache.size >= 20) {
			const oldest = this.dailyStatsRangeCache.keys().next().value;
			if (oldest !== undefined) this.dailyStatsRangeCache.delete(oldest);
		}

		let result: ExtendedDailyStats[];
		if (!this.isFilterActive) {
			result = this.sessionPersistence.getStatsInRange(startKey, endKey);
		} else {
			// Derive from full-history cache instead of a separate DB query
			const fullHistory = this.getFilteredDailyStats();
			result = [];
			for (const [date, stats] of Object.entries(fullHistory)) {
				if (date >= startKey && date <= endKey) result.push(stats);
			}
			result.sort((a, b) => a.date.localeCompare(b.date));
		}

		this.dailyStatsRangeCache.set(cacheKey, result);
		return result;
	}

	getAllDailyStats(): Record<string, ExtendedDailyStats> {
		return this.getFilteredDailyStats();
	}

	getCardMaturityBreakdown(): CardMaturityBreakdown {
		const cards = this.getFilteredCards();
		return this.maturityCalculator.calculate(cards);
	}

	getFutureDueStats(range: StatsTimeRange): FutureDueEntry[] {
		const cards = this.getFilteredCards();
		return this.chartDataCalculator.getFutureDueStats(cards, range);
	}

	async getReviewHistory(range: StatsTimeRange): Promise<ExtendedDailyStats[]> {
		return this.getReviewHistorySync(range);
	}

	getReviewHistorySync(range: StatsTimeRange): ExtendedDailyStats[] {
		const endDate = new Date();
		const startDate = this.calculateStartDate(endDate, range);

		const startKey = startDate.toISOString().split("T")[0] ?? "";
		const endKey = endDate.toISOString().split("T")[0] ?? "";

		return this.getFilteredDailyStatsInRange(startKey, endKey);
	}

	getTodaySummary(): TodaySummary {
		if (this.isFilterActive) {
			const today = new Date().toISOString().split("T")[0] ?? "";
			const todayStats = this.getFilteredDailyStats()[today];
			if (!todayStats) return emptyTodaySummary();

			const totalRatings =
				(todayStats.again ?? 0) +
				(todayStats.hard ?? 0) +
				(todayStats.good ?? 0) +
				(todayStats.easy ?? 0);
			const correctReviews = (todayStats.good ?? 0) + (todayStats.easy ?? 0);

			return {
				studied: todayStats.reviewsCompleted,
				minutes: Math.round(todayStats.totalTimeMs / 60000),
				newCards: todayStats.newCardsStudied,
				reviewCards: todayStats.reviewCards ?? 0,
				again: todayStats.again ?? 0,
				correctRate: totalRatings > 0 ? correctReviews / totalRatings : 0,
			};
		}

		const todayStats = this.sessionPersistence.getTodayStats();

		const totalRatings =
			(todayStats.again ?? 0) +
			(todayStats.hard ?? 0) +
			(todayStats.good ?? 0) +
			(todayStats.easy ?? 0);
		const correctReviews = (todayStats.good ?? 0) + (todayStats.easy ?? 0);

		return {
			studied: todayStats.reviewsCompleted,
			minutes: Math.round(todayStats.totalTimeMs / 60000),
			newCards: todayStats.newCardsStudied,
			reviewCards: todayStats.reviewCards ?? 0,
			again: todayStats.again ?? 0,
			correctRate: totalRatings > 0 ? correctReviews / totalRatings : 0,
		};
	}

	getStreakInfo(): StreakInfo {
		const allStats = this.getFilteredDailyStats();
		return this.streakCalculator.calculate(allStats);
	}

	async getRangeSummary(range: StatsTimeRange): Promise<{
		daysStudied: number;
		totalDays: number;
		totalReviews: number;
		avgPerDay: number;
		avgForStudiedDays: number;
		dueTomorrow: number;
		dailyLoad: number;
	}> {
		return this.getRangeSummarySync(range);
	}

	getRangeSummarySync(range: StatsTimeRange): {
		daysStudied: number;
		totalDays: number;
		totalReviews: number;
		avgPerDay: number;
		avgForStudiedDays: number;
		dueTomorrow: number;
		dailyLoad: number;
	} {
		const history = this.getReviewHistorySync(range);
		const cards = this.getFilteredCards();

		const endDate = new Date();
		const startDate = this.calculateStartDate(endDate, range);
		const totalDays = Math.ceil(
			(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
		);

		const daysStudied = history.filter((d) => d.reviewsCompleted > 0).length;
		const totalReviews = history.reduce(
			(sum, d) => sum + d.reviewsCompleted,
			0,
		);

		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		const tomorrowEnd = new Date(tomorrow);
		tomorrowEnd.setHours(23, 59, 59, 999);

		const dueTomorrow = cards.filter((c) => {
			if (c.fsrs.state === State.New) return false;
			const dueDate = new Date(c.fsrs.due);
			return dueDate >= tomorrow && dueDate <= tomorrowEnd;
		}).length;

		const futureStats = this.getFutureDueStats("1m");
		const dailyLoad =
			futureStats.length > 0
				? Math.round(
						futureStats.reduce((sum, d) => sum + d.count, 0) /
							Math.max(futureStats.length, 1),
					)
				: 0;

		return {
			daysStudied,
			totalDays,
			totalReviews,
			avgPerDay: totalDays > 0 ? Math.round(totalReviews / totalDays) : 0,
			avgForStudiedDays:
				daysStudied > 0 ? Math.round(totalReviews / daysStudied) : 0,
			dueTomorrow,
			dailyLoad,
		};
	}

	getRatingDistributionHistory(
		range: StatsTimeRange,
	): RatingDistributionEntry[] {
		const allStats = this.getFilteredDailyStats();
		return this.chartDataCalculator.getRatingDistributionHistory(
			allStats,
			range,
		);
	}

	getCollectionHealthSnapshot(): CollectionHealthSnapshot {
		const filteredCards = this.getFilteredCards();
		const minuteBucket = Math.floor(Date.now() / 60000);

		if (
			this.healthCache &&
			this.healthCache.filterKey === this.filterCacheKey &&
			this.healthCache.source === filteredCards &&
			this.healthCache.minuteBucket === minuteBucket
		) {
			return this.healthCache.result;
		}

		const allCards = filteredCards.filter(
			(c) => c.fsrs.state !== State.New && !c.fsrs.suspended,
		);

		if (allCards.length === 0) {
			const result: CollectionHealthSnapshot = {
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
		const retrievabilities = allCards.map((c) =>
			this.fsrsService.getRetrievability(c.fsrs, now),
		);

		const avg =
			retrievabilities.reduce((s, r) => s + r, 0) / retrievabilities.length;

		const result: CollectionHealthSnapshot = {
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

	getNotePerformance(): NotePerformanceRow[] {
		if (this.sqliteStore) {
			if (this.isFilterActive) {
				return this.sqliteStore.stats.getNotePerformanceFiltered(
					[...this.filter.archivedSourceUids],
					this.filter.presetSourceUids
						? [...this.filter.presetSourceUids]
						: undefined,
				);
			}
			return this.sqliteStore.stats.getNotePerformance();
		}
		return [];
	}

	getRetentionHistory(range: StatsTimeRange): RetentionEntry[] {
		const allStats = this.getFilteredDailyStats();
		return this.chartDataCalculator.getRetentionHistory(allStats, range);
	}

	private calculateStartDate(today: Date, range: StatsTimeRange): Date {
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

	getFutureDueStatsFilled(range: StatsTimeRange): FutureDueEntry[] {
		const cards = this.getFilteredCards();
		return this.chartDataCalculator.getFutureDueStatsFilled(cards, range);
	}

	getCardsDueOnDate(date: string): FSRSFlashcardItem[] {
		const cards = this.getFilteredCards();
		return this.chartDataCalculator.getCardsDueOnDate(cards, date);
	}

	getCardsByCategory(
		category: keyof CardMaturityBreakdown,
	): FSRSFlashcardItem[] {
		const cards = this.getFilteredCards();
		return this.maturityCalculator.getCardsByCategory(cards, category);
	}

	async getCardsCreatedHistoryFilled(
		range: StatsTimeRange,
	): Promise<CardsCreatedEntry[]> {
		return this.getCardsCreatedHistoryFilledSync(range);
	}

	getCardsCreatedHistoryFilledSync(range: StatsTimeRange): CardsCreatedEntry[] {
		const cards = this.getFilteredCards();
		return this.chartDataCalculator.getCardsCreatedHistoryFilledSync(
			cards,
			range,
		);
	}

	getCardsCreatedOnDate(date: string): FSRSFlashcardItem[] {
		const cards = this.getFilteredCards();
		return this.chartDataCalculator.getCardsCreatedOnDate(cards, date);
	}

	private clearDailyStatsCaches(): void {
		this.dailyStatsCache.clear();
		this.dailyStatsRangeCache.clear();
		this.healthCache = null;
	}

	private buildFilterCacheKey(ctx: StatsFilterContext): string {
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

const HEALTH_BUCKETS: { label: string; threshold: number; colorVar: string }[] =
	[
		{ label: "At risk (<50%)", threshold: 0.5, colorVar: "--color-red" },
		{ label: "Low (50–70%)", threshold: 0.7, colorVar: "--color-orange" },
		{ label: "Medium (70–85%)", threshold: 0.85, colorVar: "--color-yellow" },
		{ label: "High (85–95%)", threshold: 0.95, colorVar: "--color-green" },
		{ label: "Strong (>95%)", threshold: 1, colorVar: "--color-cyan" },
	];

function buildHealthBuckets(retrievabilities: number[]): HealthBucket[] {
	const counts = new Map<number, number>(HEALTH_BUCKETS.map((_, i) => [i, 0]));
	for (const r of retrievabilities) {
		const idx = HEALTH_BUCKETS.findIndex((b) => r < b.threshold);
		const bucketIdx = idx === -1 ? HEALTH_BUCKETS.length - 1 : idx;
		counts.set(bucketIdx, (counts.get(bucketIdx) ?? 0) + 1);
	}
	return HEALTH_BUCKETS.map((b, i) => ({
		label: b.label,
		count: counts.get(i) ?? 0,
		colorVar: b.colorVar,
	}));
}

function emptyTodaySummary(): TodaySummary {
	return {
		studied: 0,
		minutes: 0,
		newCards: 0,
		reviewCards: 0,
		again: 0,
		correctRate: 0,
	};
}
