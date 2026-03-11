import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import {
	EMPTY_FILTER,
	type StatsFilterContext,
} from "@features/metrics/services/stats/stats-filter.types";
import type {
	TrueRetentionSnapshot,
} from "@features/metrics/services/fsrs-tools/statistics/true-retention.calculator";
import { useSignal } from "@preact/signals";
import {
	allCardsArray,
	pluginSettings,
} from "@shared/services/reactive-card-store";
import type {
	CardMaturityBreakdown,
	CollectionHealthSnapshot,
	ExtendedDailyStats,
	FutureDueEntry,
	RatingDistributionEntry,
	RetentionEntry,
	StatsTimeRange,
	StreakInfo,
	TodaySummary,
	CardsCreatedEntry,
} from "@shared/types";
import { usePlugin } from "@shared/ui/preact";
import { useEffect, useMemo } from "preact/hooks";
import type { Signal } from "@preact/signals";

export interface StatsData {
	today: TodaySummary;
	streak: StreakInfo;
	maturity: CardMaturityBreakdown;
	health: CollectionHealthSnapshot;
	futureDue: FutureDueEntry[];
	reviewHistory: ExtendedDailyStats[];
	retention: RetentionEntry[];
	ratingDistribution: RatingDistributionEntry[];
	cardsCreated: CardsCreatedEntry[];
	rangeSummary: {
		daysStudied: number;
		totalDays: number;
		totalReviews: number;
		avgPerDay: number;
		avgForStudiedDays: number;
		dueTomorrow: number;
		dailyLoad: number;
	};
	allDailyStats: Record<string, ExtendedDailyStats>;
	totalCards: number;
	trueRetention: TrueRetentionSnapshot | null;
}

const EMPTY_RANGE_SUMMARY = {
	daysStudied: 0,
	totalDays: 0,
	totalReviews: 0,
	avgPerDay: 0,
	avgForStudiedDays: 0,
	dueTomorrow: 0,
	dailyLoad: 0,
};

export function useStatsData(
	timeRange: Signal<StatsTimeRange>,
	filter?: Signal<StatsFilterContext | null>,
): {
	data: StatsData | null;
	loading: boolean;
} {
	const plugin = usePlugin();
	const loading = useSignal(true);
	const data = useSignal<StatsData | null>(null);

	const statsCalc = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);
		calc.setSqliteStore(plugin.cardStore);
		return calc;
	}, [plugin]);

	// Single unified async pipeline — stale-while-revalidate
	useEffect(() => {
		let cancelled = false;
		loading.value = true;

		const cards = allCardsArray.value;
		pluginSettings.value;
		const range = timeRange.value;
		const f = filter?.value;

		// Fast O(1) setup — does not block render
		statsCalc.setCardSnapshot(cards);
		statsCalc.setFilter(f ?? EMPTY_FILTER);

		// Yield to renderer, then compute everything in one batch
		const timeoutId = setTimeout(() => {
			if (cancelled) return;

			const today = statsCalc.getTodaySummary();
			const streak = statsCalc.getStreakInfo();
			const maturity = statsCalc.getCardMaturityBreakdown();
			const health = statsCalc.getCollectionHealthSnapshot();
			const futureDue = statsCalc.getFutureDueStatsFilled(range);
			const retention = statsCalc.getRetentionHistory(range);
			const ratingDistribution = statsCalc.getRatingDistributionHistory(range);
			const allDailyStats = statsCalc.getAllDailyStats();

			// Previously in the separate async effect
			const reviewHistory = statsCalc.getReviewHistorySync(range);
			const cardsCreated = statsCalc.getCardsCreatedHistoryFilledSync(range);
			const rangeSummary = statsCalc.getRangeSummarySync(range);

			// Previously a separate useMemo in StatsApp
			let trueRetention: TrueRetentionSnapshot | null = null;
			if (plugin.fsrsHelper) {
				const presetNamesArr = f?.presetNames
					? [...f.presetNames]
					: undefined;
				trueRetention = plugin.fsrsHelper.getTrueRetentionSnapshot(
					30,
					presetNamesArr,
				);
			}

			if (cancelled) return;

			data.value = {
				today,
				streak,
				maturity,
				health,
				futureDue,
				reviewHistory,
				retention,
				ratingDistribution,
				cardsCreated,
				rangeSummary,
				allDailyStats,
				totalCards: cards.length,
				trueRetention,
			};
			loading.value = false;
		}, 0);

		return () => {
			cancelled = true;
			clearTimeout(timeoutId);
		};
	}, [allCardsArray.value, pluginSettings.value, timeRange.value, filter?.value, statsCalc, plugin.fsrsHelper, loading, data]);

	return {
		data: data.value,
		loading: loading.value,
	};
}
