import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { cards, pluginSettings } from "@true-recall/obsidian/services/reactive-card-store";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
function formatSteps(steps) {
    return steps
        .map((s) => (s >= 60 ? `${Math.round(s / 60)}h` : `${s}m`))
        .join(", ");
}
function formatDaysAgo(isoDate) {
    const then = new Date(isoDate).getTime();
    const daysAgo = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
    if (daysAgo === 0)
        return { text: "today", stale: false };
    if (daysAgo === 1)
        return { text: "yesterday", stale: false };
    return { text: `${daysAgo} days ago`, stale: daysAgo > 30 };
}
export function PresetInfoWidget({ source }) {
    var _a, _b, _c;
    const plugin = usePlugin();
    const config = useMemo(() => parseCodeblockConfig(source), [source]);
    const presetName = configValue(config, "preset", "");
    const showWeights = configValue(config, "showWeights", false);
    const showLimits = configValue(config, "showLimits", true);
    const preset = useComputed(() => {
        var _a;
        void cards.value;
        void pluginSettings.value;
        if (presetName) {
            return (_a = plugin.presetService.getPresetByName(presetName)) !== null && _a !== void 0 ? _a : null;
        }
        try {
            return plugin.presetService.getDefaultPreset();
        }
        catch (_b) {
            return null;
        }
    }).value;
    if (!preset) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: presetName
                ? `Preset "${presetName}" not found`
                : "No FSRS presets configured" }));
    }
    const presetReviews = (_c = (_b = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.stats) === null || _b === void 0 ? void 0 : _b.getReviewCountForPreset(preset.name)) !== null && _c !== void 0 ? _c : 0;
    const reviewsSinceOpt = preset.lastOptimizationReviewCount != null
        ? presetReviews - preset.lastOptimizationReviewCount
        : presetReviews;
    const needsOptimization = !preset.lastOptimization ||
        reviewsSinceOpt > 500 ||
        formatDaysAgo(preset.lastOptimization).stale;
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between", children: [_jsx("span", { class: "ep:font-semibold ep:text-xs", children: preset.name }), _jsx("span", { class: "ep:text-xs ep:text-obs-muted", children: "FSRS Preset" })] }), _jsxs("div", { class: "ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:text-xs", children: [_jsx(ParamRow, { label: "Retention", value: `${Math.round(preset.requestRetention * 100)}%` }), _jsx(ParamRow, { label: "Max interval", value: `${preset.maximumInterval}d` }), showLimits && (_jsxs(_Fragment, { children: [_jsx(ParamRow, { label: "New/day", value: String(preset.newCardsPerDay) }), _jsx(ParamRow, { label: "Reviews/day", value: String(preset.reviewsPerDay) })] })), _jsx(ParamRow, { label: "Learn steps", value: preset.learningSteps.length > 0
                            ? formatSteps(preset.learningSteps)
                            : "none" }), _jsx(ParamRow, { label: "Relearn steps", value: preset.relearningSteps.length > 0
                            ? formatSteps(preset.relearningSteps)
                            : "none" })] }), _jsx("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-xs ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: _jsx(OptimizationStatus, { lastOptimization: preset.lastOptimization, needsOptimization: needsOptimization, reviewsSinceOpt: reviewsSinceOpt, metrics: preset.lastOptimizationMetrics }) }), showWeights && preset.weights && (_jsxs("div", { class: "ep:text-xs ep:text-obs-muted ep:pt-1 ep:border-t ep:border-obs-modifier-border", children: [_jsxs("div", { class: "ep:font-medium ep:mb-1", children: ["Weights (", preset.weights.length, ")"] }), _jsx("div", { class: "ep:font-mono ep:text-[10px] ep:leading-relaxed ep:break-all", children: preset.weights.map((w) => w.toFixed(4)).join(", ") })] }))] }));
}
function ParamRow({ label, value }) {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between", children: [_jsx("span", { class: "ep:text-obs-muted", children: label }), _jsx("span", { class: "ep:font-medium", children: value })] }));
}
function OptimizationStatus({ lastOptimization, needsOptimization, reviewsSinceOpt, metrics, }) {
    if (!lastOptimization) {
        return (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:inline-block ep:w-2 ep:h-2 ep:rounded-full", style: { background: "var(--color-red)" } }), _jsx("span", { style: { color: "var(--color-red)" }, children: "Never optimized" }), reviewsSinceOpt > 0 && (_jsxs("span", { class: "ep:text-obs-muted ep:ml-auto", children: [reviewsSinceOpt, " reviews available"] }))] }));
    }
    const { text } = formatDaysAgo(lastOptimization);
    const color = needsOptimization
        ? "var(--color-orange)"
        : "var(--color-green)";
    return (_jsxs(_Fragment, { children: [_jsx("span", { class: "ep:inline-block ep:w-2 ep:h-2 ep:rounded-full", style: { background: color } }), _jsxs("span", { children: ["Optimized ", _jsx("span", { style: { color }, children: text })] }), metrics && (_jsxs("span", { class: "ep:text-obs-muted", children: ["RMSE: ", metrics.rmse.toFixed(4)] })), needsOptimization && (_jsx("span", { class: "ep:ml-auto ep:font-medium", style: { color: "var(--color-orange)" }, children: "Optimize \u2192" })), !needsOptimization && reviewsSinceOpt > 0 && (_jsxs("span", { class: "ep:text-obs-muted ep:ml-auto", children: ["+", reviewsSinceOpt, " reviews"] }))] }));
}
