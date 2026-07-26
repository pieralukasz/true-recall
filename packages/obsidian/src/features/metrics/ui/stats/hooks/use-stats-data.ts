import type { ReadonlySignal, Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";

import { getErrorMessage } from "@true-recall/core/errors";
import type { TrueRetentionSnapshot } from "@true-recall/core/metrics/fsrs-tools/statistics/true-retention.calculator";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import {
	EMPTY_FILTER,
	type StatsFilterContext,
} from "@true-recall/core/metrics/stats/stats-filter.types";
import type {
	CardMaturityBreakdown,
	CardSchedulingMeta,
	CardsCreatedEntry,
	CollectionHealthSnapshot,
	ExtendedDailyStats,
	FutureDueEntry,
	RatingDistributionEntry,
	RetentionEntry,
	StatsTimeRange,
	StreakInfo,
	TodaySummary,
	TrueRecallSettings,
} from "@true-recall/core/types";

import { Q, useQuery } from "@true-recall/obsidian/data";
import { useGatedComputed, usePlugin } from "@true-recall/obsidian/preact";

// Trailing delay before rerunning the full stats pipeline after a card-data
// change. Rapid review grading resets the timer, so at most one ~1s compute
// runs per pause instead of one per grade. The initial load stays immediate.
const RECOMPUTE_DEBOUNCE_MS = 300;

interface StatsData {
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

export function useStatsData(
	timeRange: Signal<StatsTimeRange>,
	filter: Signal<StatsFilterContext | null> | undefined,
	isViewVisible: ReadonlySignal<boolean>,
): {
	data: StatsData | null;
	loading: boolean;
	error: string | null;
} {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const settingsSignal = useQuery<TrueRecallSettings>(Q.SETTINGS);
	const loading = useSignal(true);
	const data = useSignal<StatsData | null>(null);
	const error = useSignal<string | null>(null);

	const statsCalc = useMemo(() => {
		const calc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
			plugin.settings.dayStartHour,
		);
		calc.setSqliteStore(plugin.cardStore);
		return calc;
	}, [plugin]);

	// Gated snapshot: while the stats view is hidden, card-data changes are
	// neither subscribed nor recomputed, so the effect below (the expensive
	// pipeline) does not rerun. On reveal the fresh snapshot reruns it once.
	const cardSnapshot = useGatedComputed(
		() => [...allMeta.value.values()],
		() => [allMeta.value],
		{ isVisible: isViewVisible },
	);

	// Single unified async pipeline — stale-while-revalidate
	useEffect(() => {
		let cancelled = false;
		loading.value = true;

		const range = timeRange.value;
		const f = filter?.value;

		statsCalc.setCardSnapshot(cardSnapshot);
		statsCalc.setFilter(f ?? EMPTY_FILTER);

		// Yield to renderer, then compute everything in one batch. After the
		// initial load, debounce so a burst of changes runs the pipeline once.
		const delayMs = data.peek() === null ? 0 : RECOMPUTE_DEBOUNCE_MS;
		const timeoutId = window.setTimeout(() => {
			if (cancelled) return;

			try {
				const today = statsCalc.getTodaySummary();
				const streak = statsCalc.getStreakInfo();
				const maturity = statsCalc.getCardMaturityBreakdown();
				const health = statsCalc.getCollectionHealthSnapshot();
				const futureDue = statsCalc.getFutureDueStatsFilled(range);
				const retention = statsCalc.getRetentionHistory(range);
				const ratingDistribution =
					statsCalc.getRatingDistributionHistory(range);
				const allDailyStats = statsCalc.getAllDailyStats();

				const reviewHistory = statsCalc.getReviewHistorySync(range);
				const cardsCreated = statsCalc.getCardsCreatedHistoryFilledSync(range);
				const rangeSummary = statsCalc.getRangeSummarySync(range);

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

				error.value = null;
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
					totalCards: cardSnapshot.length,
					trueRetention,
				};
			} catch (e) {
				if (cancelled) return;
				console.error("[StatsView] Error computing statistics:", e);
				error.value = getErrorMessage(e);
				data.value = null;
			} finally {
				if (!cancelled) loading.value = false;
			}
		}, delayMs);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [
		cardSnapshot,
		settingsSignal.value,
		timeRange.value,
		filter?.value,
		statsCalc,
		plugin.fsrsHelper,
		data,
		error,
		loading,
	]);

	return {
		data: data.value,
		loading: loading.value,
		error: error.value,
	};
}
