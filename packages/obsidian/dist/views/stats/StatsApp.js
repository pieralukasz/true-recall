import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useComputed, useSignal } from "@preact/signals";
import { getFilteredDistributions } from "@true-recall/core/metrics/distribution-filter";
import { buildDayOfWeekStats, buildFilteredForecast, buildForecastSummary, } from "@true-recall/core/metrics/forecast-filter";
import { buildSourceUidToPresetMap } from "@true-recall/core/metrics/stats/stats-filter.helpers";
import { AppNavBar } from "@true-recall/obsidian/components";
import { HeatmapWidget } from "@true-recall/obsidian/editor/study/widgets/analytics/HeatmapWidget";
import { CardMaturitySection, ChartCard, CollectionHealthBar, CreatedVsReviewedChart, DistributionSection, FSRSStatusCard, PresetFilter, RangeSummary, RatingDistributionChart, RetentionChart, ReviewHistoryChart, StatsHeader, TodayHero, TrueRetentionCard, WorkloadForecastSection, } from "@true-recall/obsidian/features/metrics/ui/stats/components";
import { useStatsData } from "@true-recall/obsidian/features/metrics/ui/stats/hooks/use-stats-data";
import { usePlugin } from "@true-recall/obsidian/preact";
import { allCardsArray, archivedSourceUids as archivedSourceUidsSignal, pluginSettings, } from "@true-recall/obsidian/services/reactive-card-store";
import { useEffect, useMemo, useState } from "preact/hooks";
export function StatsApp() {
    var _a, _b;
    const plugin = usePlugin();
    const timeRange = useSignal("1m");
    const settings = pluginSettings.value;
    const allCards = allCardsArray.value;
    const [renderStage, setRenderStage] = useState(0);
    const presetNames = settings.fsrsPresets.map((preset) => preset.name);
    const selectedPresets = useSignal(new Set(presetNames));
    useEffect(() => {
        const current = selectedPresets.value;
        if (presetNames.length === 0) {
            if (current.size > 0)
                selectedPresets.value = new Set();
            return;
        }
        if (current.size === 0) {
            selectedPresets.value = new Set(presetNames);
            return;
        }
        const valid = new Set([...current].filter((name) => presetNames.includes(name)));
        if (valid.size === 0) {
            selectedPresets.value = new Set(presetNames);
            return;
        }
        if (valid.size !== current.size) {
            selectedPresets.value = valid;
        }
    }, [presetNames.join("|")]);
    const presetSourceUidIndex = useMemo(() => {
        const index = new Map();
        if (!plugin.presetService || allCards.length === 0)
            return index;
        const sourceUidToPreset = buildSourceUidToPresetMap(plugin.presetService, allCards);
        for (const [sourceUid, presetName] of sourceUidToPreset.entries()) {
            let uids = index.get(presetName);
            if (!uids) {
                uids = new Set();
                index.set(presetName, uids);
            }
            uids.add(sourceUid);
        }
        return index;
    }, [plugin.presetService, allCards, settings]);
    // Build preset→sourceUid map and compute filter context
    const filterContext = useComputed(() => {
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
        const sourceUids = new Set();
        for (const name of selected) {
            const presetUids = presetSourceUidIndex.get(name);
            if (!presetUids)
                continue;
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
        if (!(filter === null || filter === void 0 ? void 0 : filter.presetSourceUids))
            return allCards;
        return allCards.filter((card) => {
            var _a;
            return card.sourceUid !== undefined &&
                ((_a = filter.presetSourceUids) === null || _a === void 0 ? void 0 : _a.has(card.sourceUid));
        });
    }, [allCards, filterContext.value]);
    const filteredCardFsrs = useMemo(() => filteredCards.map((card) => card.fsrs), [filteredCards]);
    const { data, loading, error } = useStatsData(timeRange, filterContext);
    // Staged chart rendering to avoid blocking the main thread.
    // Charts are expensive to mount (Chart.js, D3 heatmap), so we paint them
    // in three passes: stage 1 = hero + retention, stage 2 = core charts,
    // stage 3 = distributions. Each stage defers to the next animation frame
    // or idle callback so the browser stays responsive.
    useEffect(() => {
        if (!data) {
            setRenderStage(0);
            return;
        }
        let cancelled = false;
        let rafId = null;
        let idleId = null;
        let timeoutId = null;
        setRenderStage(1);
        rafId = requestAnimationFrame(() => {
            if (cancelled)
                return;
            setRenderStage(2);
            const flushFinalStage = () => {
                if (!cancelled)
                    setRenderStage(3);
            };
            if ("requestIdleCallback" in window) {
                idleId = window.requestIdleCallback(flushFinalStage, {
                    timeout: 250,
                });
            }
            else {
                timeoutId = setTimeout(flushFinalStage, 0);
            }
        });
        return () => {
            cancelled = true;
            if (rafId !== null)
                cancelAnimationFrame(rafId);
            if (idleId !== null && "cancelIdleCallback" in window) {
                window.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null)
                clearTimeout(timeoutId);
        };
    }, [data, timeRange.value, filterContext.value]);
    const targetRetention = Math.round(((_a = settings.fsrsRequestRetention) !== null && _a !== void 0 ? _a : 0.9) * 100);
    const trueRetention = (_b = data === null || data === void 0 ? void 0 : data.trueRetention) !== null && _b !== void 0 ? _b : null;
    // FSRS workload forecast — filtered by preset via card filtering
    const workloadData = useMemo(() => {
        var _a;
        if (renderStage < 2)
            return null;
        const forecast = buildFilteredForecast(filteredCardFsrs, 30);
        const target = (_a = settings.loadBalanceTarget) !== null && _a !== void 0 ? _a : 50;
        return {
            forecast,
            summary: buildForecastSummary(forecast, target),
            dayOfWeek: buildDayOfWeekStats(forecast),
        };
    }, [renderStage, filteredCardFsrs, settings.loadBalanceTarget]);
    // FSRS distributions — filtered by preset via card filtering
    const distributions = useMemo(() => {
        if (renderStage < 3)
            return null;
        return getFilteredDistributions(filteredCards);
    }, [renderStage, filteredCards]);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:h-full", children: [_jsx(AppNavBar, { activeItem: "stats" }), _jsx("div", { class: "ep:flex-1 ep:min-h-0 ep:overflow-y-auto", children: _jsxs("div", { class: "ep:p-3 ep:mx-auto ep:max-w-5xl ep:flex ep:flex-col ep:gap-3", children: [_jsx(StatsHeader, { timeRange: timeRange }), _jsx(PresetFilter, { presets: presetNames, selected: selectedPresets }), !data && !error && loading && (_jsx("div", { class: "ep:text-xs ep:text-obs-muted ep:text-center ep:py-12", children: "Loading statistics..." })), !data && error && (_jsxs("div", { class: "ep:text-xs ep:text-obs-error ep:text-center ep:py-12", children: ["Failed to load statistics: ", error] })), data && (_jsxs(_Fragment, { children: [_jsx(TodayHero, { today: data.today, streak: data.streak, dueTomorrow: data.rangeSummary.dueTomorrow, dailyLoad: data.rangeSummary.dailyLoad, totalCards: data.totalCards }), _jsx(FSRSStatusCard, { selectedPresets: selectedPresets }), renderStage < 2 && (_jsx("div", { class: "ep:text-xs ep:text-obs-muted ep:py-2", children: "Rendering core charts..." })), renderStage >= 2 && (_jsxs(_Fragment, { children: [_jsx(ChartCard, { title: "Activity", subtitle: "Review heatmap", children: _jsx(HeatmapWidget, { source: "months: 12" }) }), trueRetention && (_jsx(TrueRetentionCard, { summary: trueRetention.summary, history: trueRetention.history })), workloadData && (_jsx(WorkloadForecastSection, { forecast: workloadData.forecast, summary: workloadData.summary, dayOfWeek: workloadData.dayOfWeek }))] })), renderStage < 3 && (_jsx("div", { class: "ep:text-xs ep:text-obs-muted ep:py-2", children: "Rendering remaining charts..." })), renderStage >= 3 && (_jsxs(_Fragment, { children: [_jsx(ReviewHistoryChart, { data: data.reviewHistory }), _jsx(CardMaturitySection, { data: data.maturity }), _jsx(RetentionChart, { data: data.retention, targetRetention: targetRetention }), _jsx(RatingDistributionChart, { data: data.ratingDistribution }), _jsx(CollectionHealthBar, { data: data.health }), _jsx(DistributionSection, { data: distributions }), _jsx(CreatedVsReviewedChart, { created: data.cardsCreated, reviewHistory: data.reviewHistory }), _jsx(RangeSummary, { data: data.rangeSummary })] }))] }))] }) })] }));
}
