import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSignal } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { ChartCard } from "./ChartCard";
export function FSRSStatusCard({ selectedPresets }) {
    const plugin = usePlugin();
    const presetStatuses = useMemo(() => {
        var _a;
        const selected = selectedPresets.value;
        const statuses = [];
        for (const name of selected) {
            const preset = (_a = plugin.presetService) === null || _a === void 0 ? void 0 : _a.getPresetByName(name);
            if (!preset)
                continue;
            statuses.push(buildPresetStatus(preset, plugin));
        }
        return statuses.sort((a, b) => a.name.localeCompare(b.name));
    }, [plugin, selectedPresets.value]);
    if (presetStatuses.length === 0) {
        return (_jsx(ChartCard, { title: "FSRS Status", subtitle: "Optimization & parameters", children: _jsx("p", { class: "ep:text-xs ep:text-obs-muted ep:py-4 ep:text-center", children: "No presets selected" }) }));
    }
    return (_jsx(ChartCard, { title: "FSRS Status", subtitle: "Optimization & parameters", children: _jsx("div", { class: "ep:space-y-4", children: presetStatuses.map((status) => (_jsx(PresetStatusEntry, { status: status, showName: presetStatuses.length > 1 }, status.name))) }) }));
}
function buildPresetStatus(preset, plugin) {
    var _a, _b, _c, _d;
    const retention = Math.round(preset.requestRetention * 100);
    const weights = (_a = preset.weights) !== null && _a !== void 0 ? _a : [];
    const lastOpt = preset.lastOptimization;
    const lastOptCount = preset.lastOptimizationReviewCount;
    const metrics = preset.lastOptimizationMetrics;
    let reviewCount = 0;
    try {
        reviewCount =
            (_d = (_c = (_b = plugin.cardStore) === null || _b === void 0 ? void 0 : _b.stats) === null || _c === void 0 ? void 0 : _c.getReviewCountForPreset(preset.name)) !== null && _d !== void 0 ? _d : 0;
    }
    catch (_e) {
        // cardStore may not be available
    }
    const reviewsSinceOpt = lastOptCount != null ? Math.max(0, reviewCount - lastOptCount) : null;
    const needsOptimization = (!lastOpt && reviewCount >= 400) ||
        (reviewsSinceOpt != null && reviewsSinceOpt >= 1000);
    return {
        name: preset.name,
        retention,
        weights,
        lastOpt,
        metrics,
        reviewsSinceOpt,
        needsOptimization,
    };
}
function PresetStatusEntry({ status, showName, }) {
    const expanded = useSignal(false);
    return (_jsx("div", { class: showName
            ? "ep:border-b ep:border-obs-modifier-border-hover ep:pb-3 last:ep:border-0 last:ep:pb-0"
            : "", children: _jsxs("div", { class: "ep:space-y-2.5", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:text-sm", children: [showName && (_jsx("span", { class: "ep:font-medium ep:text-obs-normal", children: status.name })), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted", children: ["Target: ", status.retention, "%"] })] }), _jsxs("div", { class: "ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:text-xs ep:text-obs-muted", children: [_jsxs("span", { children: ["Last optimized:", " ", status.lastOpt ? formatRelativeDate(status.lastOpt) : "Never"] }), status.reviewsSinceOpt != null && (_jsxs("span", { children: [status.reviewsSinceOpt.toLocaleString(), " reviews since"] }))] }), status.metrics && (_jsxs("div", { class: "ep:flex ep:flex-wrap ep:gap-x-4 ep:gap-y-1 ep:text-xs ep:text-obs-muted", children: [_jsxs("span", { children: ["RMSE: ", status.metrics.rmse.toFixed(4)] }), _jsxs("span", { children: ["LogLoss: ", status.metrics.logLoss.toFixed(4)] }), _jsx(ConvergenceBadge, { status: status.metrics.convergenceStatus })] })), status.needsOptimization && (_jsx("div", { class: "ep:text-xs ep:text-obs-orange ep:bg-obs-orange/10 ep:px-2.5 ep:py-1.5 ep:rounded", children: "Optimization recommended \u2014 enough new reviews for better parameters" })), status.weights.length > 0 && (_jsxs("div", { class: "ep:text-xs ep:text-obs-faint", children: [_jsxs("span", { class: "ep:cursor-pointer ep:underline ep:decoration-dotted", onClick: () => {
                                expanded.value = !expanded.value;
                            }, onKeyDown: (e) => {
                                if (e.key === "Enter" || e.key === " ")
                                    expanded.value = !expanded.value;
                            }, role: "button", tabIndex: 0, children: ["Weights (", status.weights.length, ") ", expanded.value ? "[-]" : "[+]"] }), expanded.value ? (_jsxs("p", { class: "ep:mt-1 ep:font-mono ep:break-all ep:leading-relaxed", children: ["[", status.weights.map((w) => w.toFixed(4)).join(", "), "]"] })) : (_jsxs("span", { class: "ep:ml-1.5 ep:font-mono", children: ["[", status.weights
                                    .slice(0, 4)
                                    .map((w) => w.toFixed(4))
                                    .join(", "), ", ...]"] }))] }))] }) }));
}
function ConvergenceBadge({ status, }) {
    const cls = status === "converged"
        ? "ep:text-obs-green ep:bg-obs-green/10"
        : status === "insufficient_data"
            ? "ep:text-obs-orange ep:bg-obs-orange/10"
            : "ep:text-obs-muted ep:bg-obs-modifier-hover";
    const label = status === "converged"
        ? "Converged"
        : status === "insufficient_data"
            ? "Insufficient data"
            : "Max iterations";
    return (_jsx("span", { class: `ep:px-1.5 ep:py-0.5 ep:rounded ep:text-xs ${cls}`, children: label }));
}
function formatRelativeDate(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0)
        return "Today";
    if (diffDays === 1)
        return "Yesterday";
    if (diffDays < 7)
        return `${String(diffDays)} days ago`;
    if (diffDays < 30)
        return `${String(Math.floor(diffDays / 7))} weeks ago`;
    if (diffDays < 365)
        return `${String(Math.floor(diffDays / 30))} months ago`;
    return `${String(Math.floor(diffDays / 365))} years ago`;
}
