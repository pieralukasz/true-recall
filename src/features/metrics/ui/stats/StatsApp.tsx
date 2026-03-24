import { buildSourceUidToPresetMap } from "@features/metrics/services/stats/stats-filter.helpers";
import type { StatsFilterContext } from "@features/metrics/services/stats/stats-filter.types";
import { HeatmapWidget } from "@features/study/ui/editor/widgets/analytics/HeatmapWidget";
import { useComputed, useSignal } from "@preact/signals";
import {
	allCardsArray,
	archivedSourceUids as archivedSourceUidsSignal,
	pluginSettings,
} from "@shared/services/reactive-card-store";
import type { StatsTimeRange } from "@shared/types";
import { AppNavBar } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import {
	CardMaturitySection,
	ChartCard,
	CollectionHealthBar,
	CreatedVsReviewedChart,
	DistributionSection,
	FSRSStatusCard,
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
	const settings = pluginSettings.value;
	const allCards = allCardsArray.value;
	const [renderStage, setRenderStage] = useState(0);

	const presetNames = settings.fsrsPresets.map((preset) => preset.name);
	const selectedPresets = useSignal<Set<string>>(new Set(presetNames));

	useEffect(() => {
		const current = selectedPresets.value;
		if (presetNames.length === 0) {
			if (current.size > 0) selectedPresets.value = new Set();
			return;
		}

		if (current.size === 0) {
			selectedPresets.value = new Set(presetNames);
			return;
		}

		const valid = new Set(
			[...current].filter((name) => presetNames.includes(name)),
		);
		if (valid.size === 0) {
			selectedPresets.value = new Set(presetNames);
			return;
		}

		if (valid.size !== current.size) {
			selectedPresets.value = valid;
		}
	}, [presetNames.join("|")]);

	const presetSourceUidIndex = useMemo(() => {
		const index = new Map<string, Set<string>>();
		if (!plugin.presetService || allCards.length === 0) return index;

		const sourceUidToPreset = buildSourceUidToPresetMap(
			plugin.presetService,
			allCards,
		);

		for (const [sourceUid, presetName] of sourceUidToPreset.entries()) {
			let uids = index.get(presetName);
			if (!uids) {
				uids = new Set<string>();
				index.set(presetName, uids);
			}
			uids.add(sourceUid);
		}

		return index;
	}, [plugin.presetService, allCards, settings]);

	// Build preset→sourceUid map and compute filter context
	const filterContext = useComputed((): StatsFilterContext => {
		const selected = selectedPresets.value;
		const allPresets = presetNames;
		const archived = archivedSourceUidsSignal.value;

		// All selected = no preset filter, but still apply archived filter
		if (selected.size >= allPresets.length && allPresets.length > 0) {
			return {
				archivedSourceUids: archived,
				presetNames: null,
				presetSourceUids: null,
			};
		}

		if (!plugin.presetService) {
			return {
				archivedSourceUids: archived,
				presetNames: null,
				presetSourceUids: null,
			};
		}

		// Union of sourceUids for all selected presets
		const sourceUids = new Set<string>();
		for (const name of selected) {
			const presetUids = presetSourceUidIndex.get(name);
			if (!presetUids) continue;
			for (const uid of presetUids) {
				sourceUids.add(uid);
			}
		}

		return {
			archivedSourceUids: archived,
			presetNames: selected,
			presetSourceUids: sourceUids,
		};
	});

	const filteredCards = useMemo(() => {
		const filter = filterContext.value;
		if (!filter?.presetSourceUids) return allCards;

		return allCards.filter(
			(card) =>
				card.sourceUid !== undefined &&
				filter.presetSourceUids?.has(card.sourceUid),
		);
	}, [allCards, filterContext.value]);

	const filteredCardFsrs = useMemo(
		() => filteredCards.map((card) => card.fsrs),
		[filteredCards],
	);

	const { data, loading, error } = useStatsData(timeRange, filterContext);

	useEffect(() => {
		if (!data) {
			setRenderStage(0);
			return;
		}

		let cancelled = false;
		let rafId: number | null = null;
		let idleId: number | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		setRenderStage(1);
		rafId = requestAnimationFrame(() => {
			if (cancelled) return;
			setRenderStage(2);

			const flushFinalStage = () => {
				if (!cancelled) setRenderStage(3);
			};

			if ("requestIdleCallback" in window) {
				idleId = window.requestIdleCallback(flushFinalStage, {
					timeout: 250,
				}) as unknown as number;
			} else {
				timeoutId = setTimeout(flushFinalStage, 0);
			}
		});

		return () => {
			cancelled = true;
			if (rafId !== null) cancelAnimationFrame(rafId);
			if (idleId !== null && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(idleId);
			}
			if (timeoutId !== null) clearTimeout(timeoutId);
		};
	}, [data, timeRange.value, filterContext.value]);

	const targetRetention = Math.round(
		(settings.fsrsRequestRetention ?? 0.9) * 100,
	);

	const trueRetention = data?.trueRetention ?? null;

	// FSRS workload forecast — filtered by preset via card filtering
	const workloadData = useMemo(() => {
		if (renderStage < 2) return null;
		const forecast = buildFilteredForecast(filteredCardFsrs, 30);
		const target = settings.loadBalanceTarget ?? 50;
		return {
			forecast,
			summary: buildForecastSummary(forecast, target),
			dayOfWeek: buildDayOfWeekStats(forecast),
		};
	}, [renderStage, filteredCardFsrs, settings.loadBalanceTarget]);

	// FSRS distributions — filtered by preset via card filtering
	const distributions = useMemo(() => {
		if (renderStage < 3) return null;
		return getFilteredDistributions(filteredCards);
	}, [renderStage, filteredCards]);

	return (
		<div class="ep:flex ep:flex-col ep:h-full">
			<AppNavBar activeItem="stats" />
			<div class="ep:flex-1 ep:min-h-0 ep:overflow-y-auto">
				<div class="ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3">
					<StatsHeader timeRange={timeRange} />

					<PresetFilter presets={presetNames} selected={selectedPresets} />

					{!data && !error && loading && (
						<div class="ep:text-xs ep:text-obs-muted ep:text-center ep:py-12">
							Loading statistics...
						</div>
					)}

					{!data && error && (
						<div class="ep:text-xs ep:text-obs-error ep:text-center ep:py-12">
							Failed to load statistics: {error}
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

							<FSRSStatusCard selectedPresets={selectedPresets} />

							{renderStage < 2 && (
								<div class="ep:text-xs ep:text-obs-muted ep:py-2">
									Rendering core charts...
								</div>
							)}

							{renderStage >= 2 && (
								<>
									<ChartCard title="Activity" subtitle="Review heatmap">
										<HeatmapWidget source="months: 12" />
									</ChartCard>

									{trueRetention && (
										<TrueRetentionCard
											summary={trueRetention.summary}
											history={trueRetention.history}
										/>
									)}

									{workloadData && (
										<WorkloadForecastSection
											forecast={workloadData.forecast}
											summary={workloadData.summary}
											dayOfWeek={workloadData.dayOfWeek}
										/>
									)}
								</>
							)}

							{renderStage < 3 && (
								<div class="ep:text-xs ep:text-obs-muted ep:py-2">
									Rendering remaining charts...
								</div>
							)}

							{renderStage >= 3 && (
								<>
									<ReviewHistoryChart data={data.reviewHistory} />

									<CardMaturitySection data={data.maturity} />

									<RetentionChart
										data={data.retention}
										targetRetention={targetRetention}
									/>

									<RatingDistributionChart data={data.ratingDistribution} />

									<CollectionHealthBar data={data.health} />

									<DistributionSection data={distributions} />

									<CreatedVsReviewedChart
										created={data.cardsCreated}
										reviewHistory={data.reviewHistory}
									/>

									<RangeSummary data={data.rangeSummary} />
								</>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
