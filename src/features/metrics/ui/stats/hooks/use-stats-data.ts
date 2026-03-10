import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { useComputed, useSignal } from "@preact/signals";
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

export function useStatsData(timeRange: Signal<StatsTimeRange>): {
	data: StatsData | null;
	loading: boolean;
} {
	const plugin = usePlugin();
	const loading = useSignal(true);
	const asyncData = useSignal<{
		reviewHistory: ExtendedDailyStats[];
		cardsCreated: CardsCreatedEntry[];
		rangeSummary: typeof EMPTY_RANGE_SUMMARY;
	} | null>(null);

	const statsCalc = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);
		calc.setSqliteStore(plugin.cardStore);
		return calc;
	}, [plugin]);

	// Synchronous data — recomputes when cards or settings change
	const syncData = useComputed(() => {
		const cards = allCardsArray.value;
		pluginSettings.value;
		const range = timeRange.value;

		return {
			today: statsCalc.getTodaySummary(),
			streak: statsCalc.getStreakInfo(),
			maturity: statsCalc.getCardMaturityBreakdown(),
			health: statsCalc.getCollectionHealthSnapshot(),
			futureDue: statsCalc.getFutureDueStatsFilled(range),
			retention: statsCalc.getRetentionHistory(range),
			ratingDistribution: statsCalc.getRatingDistributionHistory(range),
			allDailyStats: statsCalc.getAllDailyStats(),
			totalCards: cards.length,
		};
	});

	// Async data — review history and cards created
	useEffect(() => {
		let cancelled = false;
		loading.value = true;

		const range = timeRange.value;

		Promise.all([
			statsCalc.getReviewHistory(range),
			statsCalc.getCardsCreatedHistoryFilled(range),
			statsCalc.getRangeSummary(range),
		]).then(([reviewHistory, cardsCreated, rangeSummary]) => {
			if (!cancelled) {
				asyncData.value = { reviewHistory, cardsCreated, rangeSummary };
				loading.value = false;
			}
		});

		return () => {
			cancelled = true;
		};
	}, [timeRange.value, statsCalc, loading, asyncData]);

	const data = useComputed((): StatsData | null => {
		const sync = syncData.value;
		const async_ = asyncData.value;
		if (!async_) return null;

		return {
			...sync,
			reviewHistory: async_.reviewHistory,
			cardsCreated: async_.cardsCreated,
			rangeSummary: async_.rangeSummary,
		};
	});

	return {
		data: data.value,
		loading: loading.value,
	};
}
