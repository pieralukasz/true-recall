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
	}

	private get isFilterActive(): boolean {
		return (
			this.filter.archivedSourceUids.size > 0 ||
			this.filter.presetName !== null
		);
	}

	private getFilteredCards(): FSRSFlashcardItem[] {
		let cards = this.flashcardManager.getAllFSRSCards();

		if (this.filter.archivedSourceUids.size > 0) {
			cards = cards.filter(
				(c) =>
					!c.sourceUid ||
					!this.filter.archivedSourceUids.has(c.sourceUid),
			);
		}

		if (this.filter.presetSourceUids) {
			cards = cards.filter(
				(c) =>
					c.sourceUid !== undefined &&
					this.filter.presetSourceUids!.has(c.sourceUid),
			);
		}

		return cards;
	}

	/**
	 * Get filtered daily stats from review_log when filters are active,
	 * otherwise use the fast daily_stats table path.
	 */
	private getFilteredDailyStats(): Record<string, ExtendedDailyStats> {
		if (!this.isFilterActive) {
			return this.sessionPersistence.getAllDailyStatsSummary();
		}

		if (!this.sqliteStore) return {};

		const rows = this.sqliteStore.stats.getDailyStatsFromReviewLog(
			"1970-01-01",
			new Date().toISOString().split("T")[0] ?? "",
			{
				presetName: this.filter.presetName ?? undefined,
				excludeSourceUids: [...this.filter.archivedSourceUids],
			},
		);

		const stats: Record<string, ExtendedDailyStats> = {};
		for (const row of rows) {
			stats[row.date] = row;
		}
		return stats;
	}

	private getFilteredDailyStatsInRange(
		startKey: string,
		endKey: string,
	): ExtendedDailyStats[] {
		if (!this.isFilterActive) {
			return this.sessionPersistence.getStatsInRange(startKey, endKey);
		}

		if (!this.sqliteStore) return [];

		return this.sqliteStore.stats.getDailyStatsFromReviewLog(
			startKey,
			endKey,
			{
				presetName: this.filter.presetName ?? undefined,
				excludeSourceUids: [...this.filter.archivedSourceUids],
			},
		);
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
		const endDate = new Date();
		const startDate = this.calculateStartDate(endDate, range);

		const startKey = startDate.toISOString().split("T")[0] ?? "";
		const endKey = endDate.toISOString().split("T")[0] ?? "";

		return this.getFilteredDailyStatsInRange(startKey, endKey);
	}

	getTodaySummary(): TodaySummary {
		if (this.isFilterActive && this.sqliteStore) {
			const today = new Date().toISOString().split("T")[0] ?? "";
			const rows = this.sqliteStore.stats.getDailyStatsFromReviewLog(
				today,
				today,
				{
					presetName: this.filter.presetName ?? undefined,
					excludeSourceUids: [...this.filter.archivedSourceUids],
				},
			);
			const todayStats = rows[0];
			if (!todayStats) {
				return {
					studied: 0,
					minutes: 0,
					newCards: 0,
					reviewCards: 0,
					again: 0,
					correctRate: 0,
				};
			}

			const totalRatings =
				(todayStats.again ?? 0) +
				(todayStats.hard ?? 0) +
				(todayStats.good ?? 0) +
				(todayStats.easy ?? 0);
			const correctReviews =
				(todayStats.good ?? 0) + (todayStats.easy ?? 0);

			return {
				studied: todayStats.reviewsCompleted,
				minutes: Math.round(todayStats.totalTimeMs / 60000),
				newCards: todayStats.newCardsStudied,
				reviewCards: todayStats.reviewCards ?? 0,
				again: todayStats.again ?? 0,
				correctRate:
					totalRatings > 0 ? correctReviews / totalRatings : 0,
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
		const history = await this.getReviewHistory(range);
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
		const allCards = this.getFilteredCards().filter(
			(c) => c.fsrs.state !== State.New && !c.fsrs.suspended,
		);

		if (allCards.length === 0) {
			return {
				averageRetention: 0,
				distribution: buildHealthBuckets([]),
				cardCount: 0,
			};
		}

		const now = new Date();
		const retrievabilities = allCards.map((c) =>
			this.fsrsService.getRetrievability(c.fsrs, now),
		);

		const avg =
			retrievabilities.reduce((s, r) => s + r, 0) / retrievabilities.length;

		return {
			averageRetention: Math.round(avg * 100),
			distribution: buildHealthBuckets(retrievabilities),
			cardCount: allCards.length,
		};
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
		const cards = this.getFilteredCards();
		return this.chartDataCalculator.getCardsCreatedHistoryFilled(
			cards,
			range,
		);
	}

	getCardsCreatedOnDate(date: string): FSRSFlashcardItem[] {
		const cards = this.getFilteredCards();
		return this.chartDataCalculator.getCardsCreatedOnDate(cards, date);
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
