import {
	buildSourceUidToPresetMap,
	getSourceUidsForPreset,
} from "@features/metrics/services/stats/stats-filter.helpers";
import type { StatsFilterContext } from "@features/metrics/services/stats/stats-filter.types";
import { HeatmapWidget } from "@features/study/ui/editor/widgets/analytics/HeatmapWidget";
import { useComputed, useSignal } from "@preact/signals";
import type { StatsTimeRange } from "@shared/types";
import { AppNavBar } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import {
	CardMaturitySection,
	ChartCard,
	CollectionHealthBar,
	CreatedVsReviewedChart,
	DistributionSection,
	FSRSStatusCard,
	FutureDueChart,
	PresetFilter,
	RangeSummary,
	RatingDistributionChart,
	RetentionChart,
	ReviewHistoryChart,
	StatsHeader,
	TodayHero,
	TrueRetentionCard,
	WorkloadForecastSection,
} from "./components";
import { getFilteredDistributions } from "./helpers/distribution-filter";
import {
	buildDayOfWeekStats,
	buildFilteredForecast,
	buildForecastSummary,
} from "./helpers/forecast-filter";
import { useStatsData } from "./hooks/use-stats-data";

export function StatsApp() {
	const plugin = usePlugin();
	const timeRange = useSignal<StatsTimeRange>("1m");
	const selectedPresets = useSignal<Set<string>>(new Set(["Default"]));

	const presetNames = useMemo(
		() => plugin.presetService?.getPresets().map((p) => p.name) ?? [],
		[plugin.presetService],
	);

	// Build preset→sourceUid map and compute filter context
	const filterContext = useComputed((): StatsFilterContext | null => {
		const selected = selectedPresets.value;
		const allPresets = presetNames;

		// All selected = no filter (fast path)
		if (selected.size >= allPresets.length && allPresets.length > 0) {
			return null;
		}

		if (!plugin.presetService || !plugin.flashcardManager) return null;

		const allCards = plugin.flashcardManager.getAllFSRSCards();
		const presetMap = buildSourceUidToPresetMap(
			plugin.presetService,
			allCards,
		);

		// Union of sourceUids for all selected presets
		const sourceUids = new Set<string>();
		for (const name of selected) {
			for (const uid of getSourceUidsForPreset(name, presetMap)) {
				sourceUids.add(uid);
			}
		}

		return {
			archivedSourceUids: new Set(),
			presetNames: selected,
			presetSourceUids: sourceUids,
		};
	});

	const { data, loading } = useStatsData(timeRange, filterContext);

	const targetRetention = Math.round(
		(plugin.settings.fsrsRequestRetention ?? 0.9) * 100,
	);

	// FSRS true retention — filtered by preset via SQL
	const trueRetention = useMemo(() => {
		if (!plugin.fsrsHelper) return null;
		const filter = filterContext.value;
		const presetNamesArr = filter?.presetNames
			? [...filter.presetNames]
			: undefined;
		const summary = plugin.fsrsHelper.getTrueRetentionSummary(
			30,
			presetNamesArr,
		);
		const history = plugin.fsrsHelper.getTrueRetentionHistory(
			30,
			presetNamesArr,
		);
		return { summary, history };
	}, [plugin.fsrsHelper, filterContext.value]);

	// FSRS workload forecast — filtered by preset via card filtering
	const workloadData = useMemo(() => {
		if (!plugin.fsrsHelper) return null;
		const filter = filterContext.value;

		if (!filter) {
			// No filter active — use fast path
			return {
				forecast: plugin.fsrsHelper.getWorkloadForecast(30),
				summary: plugin.fsrsHelper.getWorkloadForecastSummary(30),
				dayOfWeek: plugin.fsrsHelper.getWorkloadByDayOfWeek(30),
			};
		}

		// Filter cards by preset sourceUids
		const allCards = plugin.cardStore.getCards();
		const filteredCards = filter.presetSourceUids
			? allCards.filter(
					(c) =>
						c.sourceUid !== undefined &&
						filter.presetSourceUids!.has(c.sourceUid),
				)
			: allCards;

		const forecast = buildFilteredForecast(filteredCards, 30);
		const target = plugin.settings.loadBalanceTarget ?? 50;
		return {
			forecast,
			summary: buildForecastSummary(forecast, target),
			dayOfWeek: buildDayOfWeekStats(forecast),
		};
	}, [plugin.fsrsHelper, plugin.cardStore, filterContext.value]);

	// FSRS distributions — filtered by preset via card filtering
	const distributions = useMemo(() => {
		const filter = filterContext.value;

		if (!filter) {
			// No filter — use original calculator
			if (!plugin.fsrsHelper) return null;
			return plugin.fsrsHelper.getDistributions();
		}

		// Filter cards and compute distributions
		if (!plugin.flashcardManager) return null;
		const allCards = plugin.flashcardManager.getAllFSRSCards();
		const filteredCards = filter.presetSourceUids
			? allCards.filter(
					(c) =>
						c.sourceUid !== undefined &&
						filter.presetSourceUids!.has(c.sourceUid),
				)
			: allCards;

		return getFilteredDistributions(filteredCards);
	}, [plugin.fsrsHelper, plugin.flashcardManager, filterContext.value]);

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="stats" />
			<div class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto">
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3">
					<StatsHeader timeRange={timeRange} />

					<PresetFilter
						presets={presetNames}
						selected={selectedPresets}
					/>

					{!data && loading && (
						<div class="ep:text-xs ep:text-obs-muted ep:text-center ep:py-12">
							Loading statistics...
						</div>
					)}

					{data && (
						<>
							<TodayHero
								today={data.today}
								streak={data.streak}
								dueTomorrow={data.rangeSummary.dueTomorrow}
								dailyLoad={data.rangeSummary.dailyLoad}
								totalCards={data.totalCards}
							/>

							<ChartCard title="Activity" subtitle="Review heatmap">
								<HeatmapWidget source="months: 12" />
							</ChartCard>

							{trueRetention && (
								<TrueRetentionCard
									summary={trueRetention.summary}
									history={trueRetention.history}
								/>
							)}

							{workloadData ? (
								<WorkloadForecastSection
									forecast={workloadData.forecast}
									summary={workloadData.summary}
									dayOfWeek={workloadData.dayOfWeek}
								/>
							) : (
								<FutureDueChart data={data.futureDue} />
							)}

							<ReviewHistoryChart data={data.reviewHistory} />

							<CardMaturitySection data={data.maturity} />

							<RetentionChart
								data={data.retention}
								targetRetention={targetRetention}
							/>

							<RatingDistributionChart data={data.ratingDistribution} />

							<CollectionHealthBar data={data.health} />

							<DistributionSection data={distributions} />

							<FSRSStatusCard selectedPresets={selectedPresets} />

							<CreatedVsReviewedChart
								created={data.cardsCreated}
								reviewHistory={data.reviewHistory}
							/>

							<RangeSummary data={data.rangeSummary} />
						</>
					)}
				</div>
			</div>
		</div>
	);
}
