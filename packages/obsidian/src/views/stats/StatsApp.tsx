import { useComputed, useSignal } from "@preact/signals";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { getFilteredDistributions } from "@true-recall/core/metrics/distribution-filter";
import {
	buildDayOfWeekStats,
	buildFilteredForecast,
	buildForecastSummary,
	type ForecastRange,
	forecastRangeToDays,
} from "@true-recall/core/metrics/forecast-filter";
import { buildSourceUidToPresetMap } from "@true-recall/core/metrics/stats/stats-filter.helpers";
import type { StatsFilterContext } from "@true-recall/core/metrics/stats/stats-filter.types";
import type {
	CardSchedulingMeta,
	StatsTimeRange,
	TrueRecallSettings,
} from "@true-recall/core/types";

import { AppNavBar } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import {
	ArchivedToggle,
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
} from "@true-recall/obsidian/features/metrics/ui/stats/components";
import { useStatsData } from "@true-recall/obsidian/features/metrics/ui/stats/hooks/use-stats-data";
import { usePlugin } from "@true-recall/obsidian/preact";

import { HeatmapWidget } from "@true-recall/plugins/dashboard-codeblock/analytics/HeatmapWidget";

export function StatsApp() {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	const settingsSignal = useQuery<TrueRecallSettings>(Q.SETTINGS);
	const archivedSourceUidsSignal = useQuery<ReadonlySet<string>>(
		Q.ARCHIVED_UIDS,
	);
	const timeRange = useSignal<StatsTimeRange>("1m");
	const forecastRange = useSignal<ForecastRange>("1m");
	const showArchived = useSignal(false);
	const settings = settingsSignal.value;
	const archivedUids = archivedSourceUidsSignal.value;
	const allCards = useMemo(() => {
		const archived = archivedUids;
		if (showArchived.value || !archived || archived.size === 0)
			return [...allMeta.value.values()];
		return [...allMeta.value.values()].filter(
			(card) => !archived.has(card.sourceUid ?? ""),
		);
	}, [allMeta.value, archivedUids, showArchived.value]);
	const [renderStage, setRenderStage] = useState(0);
	const initialStagingDone = useRef(false);

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
		const archived = showArchived.value
			? new Set<string>()
			: archivedSourceUidsSignal.value;

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

	// Staged chart rendering to avoid blocking the main thread.
	// Charts are expensive to mount (Chart.js, D3 heatmap), so we paint them
	// in three passes: stage 1 = hero + retention, stage 2 = core charts,
	// stage 3 = distributions. Each stage defers to the next animation frame
	// or idle callback so the browser stays responsive.
	useEffect(() => {
		if (!data) {
			setRenderStage(0);
			initialStagingDone.current = false;
			return;
		}

		// After initial load, skip staging — charts update via props
		if (initialStagingDone.current) {
			setRenderStage(3);
			return;
		}

		let cancelled = false;
		let rafId: number | null = null;
		let idleId: number | null = null;
		let timeoutId: number | null = null;

		setRenderStage(1);
		rafId = window.requestAnimationFrame(() => {
			if (cancelled) return;
			setRenderStage(2);

			const flushFinalStage = () => {
				if (!cancelled) {
					setRenderStage(3);
					initialStagingDone.current = true;
				}
			};

			if ("requestIdleCallback" in window) {
				idleId = window.requestIdleCallback(flushFinalStage, {
					timeout: 250,
				});
			} else {
				timeoutId = (window as Window).setTimeout(flushFinalStage, 0);
			}
		});

		return () => {
			cancelled = true;
			if (rafId !== null) cancelAnimationFrame(rafId);
			if (idleId !== null && "cancelIdleCallback" in window) {
				window.cancelIdleCallback(idleId);
			}
			if (timeoutId !== null) window.clearTimeout(timeoutId);
		};
	}, [data, timeRange.value, filterContext.value]);

	const targetRetention = Math.round(
		(settings.fsrsRequestRetention ?? 0.9) * 100,
	);

	const trueRetention = data?.trueRetention ?? null;

	// FSRS workload forecast — filtered by preset via card filtering
	const workloadData = useMemo(() => {
		if (renderStage < 2) return null;
		const days = forecastRangeToDays(forecastRange.value, filteredCardFsrs);
		const forecast = buildFilteredForecast(filteredCardFsrs, days);
		const target = settings.loadBalanceTarget ?? 50;
		const maxDeviation = settings.loadBalanceMaxDeviation ?? 20;
		return {
			forecast,
			summary: buildForecastSummary(forecast, target, maxDeviation),
			dayOfWeek: buildDayOfWeekStats(forecast),
		};
	}, [
		renderStage,
		filteredCardFsrs,
		forecastRange.value,
		settings.loadBalanceTarget,
		settings.loadBalanceMaxDeviation,
	]);

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

					<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-3">
						<PresetFilter presets={presetNames} selected={selectedPresets} />
						<ArchivedToggle
							isActive={showArchived.value}
							onToggle={() => {
								showArchived.value = !showArchived.value;
							}}
						/>
					</div>

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
											range={forecastRange}
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
