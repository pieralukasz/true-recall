import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import { EMPTY_FILTER, } from "@true-recall/core/metrics/stats/stats-filter.types";
import { useSignal } from "@preact/signals";
import { getErrorMessage } from "@true-recall/core/errors";
import { allCardsArray, pluginSettings, } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useEffect, useMemo } from "preact/hooks";
export function useStatsData(timeRange, filter) {
    const plugin = usePlugin();
    const loading = useSignal(true);
    const data = useSignal(null);
    const error = useSignal(null);
    const statsCalc = useMemo(() => {
        const calc = new StatsCalculatorService(plugin.fsrsService, plugin.flashcardManager, plugin.sessionPersistence, plugin.settings.dayStartHour);
        calc.setSqliteStore(plugin.cardStore);
        return calc;
    }, [plugin]);
    // Single unified async pipeline — stale-while-revalidate
    useEffect(() => {
        let cancelled = false;
        loading.value = true;
        const cards = allCardsArray.value;
        void pluginSettings.value;
        const range = timeRange.value;
        const f = filter === null || filter === void 0 ? void 0 : filter.value;
        // Fast O(1) setup — does not block render
        statsCalc.setCardSnapshot(cards);
        statsCalc.setFilter(f !== null && f !== void 0 ? f : EMPTY_FILTER);
        // Yield to renderer, then compute everything in one batch
        const timeoutId = setTimeout(() => {
            if (cancelled)
                return;
            try {
                const today = statsCalc.getTodaySummary();
                const streak = statsCalc.getStreakInfo();
                const maturity = statsCalc.getCardMaturityBreakdown();
                const health = statsCalc.getCollectionHealthSnapshot();
                const futureDue = statsCalc.getFutureDueStatsFilled(range);
                const retention = statsCalc.getRetentionHistory(range);
                const ratingDistribution = statsCalc.getRatingDistributionHistory(range);
                const allDailyStats = statsCalc.getAllDailyStats();
                const reviewHistory = statsCalc.getReviewHistorySync(range);
                const cardsCreated = statsCalc.getCardsCreatedHistoryFilledSync(range);
                const rangeSummary = statsCalc.getRangeSummarySync(range);
                let trueRetention = null;
                if (plugin.fsrsHelper) {
                    const presetNamesArr = (f === null || f === void 0 ? void 0 : f.presetNames)
                        ? [...f.presetNames]
                        : undefined;
                    trueRetention = plugin.fsrsHelper.getTrueRetentionSnapshot(30, presetNamesArr);
                }
                if (cancelled)
                    return;
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
                    totalCards: cards.length,
                    trueRetention,
                };
            }
            catch (e) {
                if (cancelled)
                    return;
                console.error("[StatsView] Error computing statistics:", e);
                error.value = getErrorMessage(e);
                data.value = null;
            }
            finally {
                if (!cancelled)
                    loading.value = false;
            }
        }, 0);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [
        allCardsArray.value,
        pluginSettings.value,
        timeRange.value,
        filter === null || filter === void 0 ? void 0 : filter.value,
        statsCalc,
        plugin.fsrsHelper,
        loading,
        data,
    ]);
    return {
        data: data.value,
        loading: loading.value,
        error: error.value,
    };
}
