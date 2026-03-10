import {
	buildSourceUidToPresetMap,
	getSourceUidsForPreset,
} from "@features/metrics/services/stats/stats-filter.helpers";
import { HeatmapWidget } from "@features/study/ui/editor/widgets/analytics/HeatmapWidget";
import { useSignal } from "@preact/signals";
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
	RangeSummary,
	RatingDistributionChart,
	RetentionChart,
	ReviewHistoryChart,
	StatsHeader,
	TodayHero,
	TrueRetentionCard,
	WorkloadForecastSection,
} from "./components";
import {
	buildDayOfWeekStats,
	buildFilteredForecast,
	buildForecastSummary,
} from "./helpers/forecast-filter";
import { useStatsData } from "./hooks/use-stats-data";

export function StatsApp() {
	const plugin = usePlugin();
	const timeRange = useSignal<StatsTimeRange>("1m");
	const selectedPreset = useSignal<string>("All");
	const { data, loading } = useStatsData(timeRange);

	const distributions = useMemo(() => {
		if (!plugin.fsrsHelper) return null;
		return plugin.fsrsHelper.getDistributions();
	}, [plugin.fsrsHelper]);

	const targetRetention = Math.round(
		(plugin.settings.fsrsRequestRetention ?? 0.9) * 100,
	);

	const presetNames = useMemo(
		() => plugin.presetService?.getPresets().map((p) => p.name) ?? [],
		[plugin.presetService],
	);

	// FSRS true retention data
	const trueRetention = useMemo(() => {
		if (!plugin.fsrsHelper) return null;
		const summary = plugin.fsrsHelper.getTrueRetentionSummary(30);
		const history = plugin.fsrsHelper.getTrueRetentionHistory(30);
		return { summary, history };
	}, [plugin.fsrsHelper]);

	// FSRS workload forecast data — filtered by selected preset
	const workloadData = useMemo(() => {
		if (!plugin.fsrsHelper) return null;

		const preset = selectedPreset.value;

		if (preset === "All") {
			return {
				forecast: plugin.fsrsHelper.getWorkloadForecast(30),
				summary: plugin.fsrsHelper.getWorkloadForecastSummary(30),
				dayOfWeek: plugin.fsrsHelper.getWorkloadByDayOfWeek(30),
			};
		}

		// Filter cards by preset
		const allCards = plugin.cardStore.getCards();
		const presetMap = buildSourceUidToPresetMap(
			plugin.presetService,
			allCards,
		);
		const sourceUids = getSourceUidsForPreset(preset, presetMap);
		const filteredCards = allCards.filter(
			(c) => c.sourceUid && sourceUids.has(c.sourceUid),
		);

		const forecast = buildFilteredForecast(filteredCards, 30);
		const target = plugin.settings.loadBalanceTarget ?? 50;
		return {
			forecast,
			summary: buildForecastSummary(forecast, target),
			dayOfWeek: buildDayOfWeekStats(forecast),
		};
	}, [plugin.fsrsHelper, plugin.cardStore, plugin.presetService, selectedPreset.value]);

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="stats" />
			<div class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto">
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3">
					<StatsHeader timeRange={timeRange} />

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

							{/* FSRS True Retention — mature card retention vs target */}
							{trueRetention && (
								<TrueRetentionCard
									summary={trueRetention.summary}
									history={trueRetention.history}
								/>
							)}

							{/* FSRS Workload Forecast — stacked review/learning breakdown */}
							{workloadData ? (
								<WorkloadForecastSection
									forecast={workloadData.forecast}
									summary={workloadData.summary}
									dayOfWeek={workloadData.dayOfWeek}
									presets={presetNames}
									selectedPreset={selectedPreset}
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

							{/* FSRS Optimization Status */}
							<FSRSStatusCard />

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
