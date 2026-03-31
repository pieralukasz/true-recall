import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { FSRS_CONFIG } from "@true-recall/core/constants";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ActionButton, FormCard, FormField, InfoBlock, TextAreaInput, } from "@true-recall/obsidian/components";
import { useCallback, useState } from "preact/hooks";
export function ParametersSection({ preset, updatePreset, plugin, onRefresh, }) {
    var _a, _b, _c, _d;
    const [optimizing, setOptimizing] = useState(false);
    const presetReviews = (_c = (_b = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.stats) === null || _b === void 0 ? void 0 : _b.getReviewCountForPreset(preset.name)) !== null && _c !== void 0 ? _c : 0;
    const canOptimize = presetReviews >= FSRS_CONFIG.minReviewsForOptimization;
    const lastOpt = preset.lastOptimization;
    const lastOptCount = preset.lastOptimizationReviewCount;
    const weightsString = preset.weights ? preset.weights.join(", ") : "";
    const handleOptimize = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        setOptimizing(true);
        try {
            const result = yield ((_a = plugin.fsrsHelper) === null || _a === void 0 ? void 0 : _a.optimizeParameters(undefined, preset.name, preset.weights));
            if (result && result.metrics.convergenceStatus !== "insufficient_data") {
                yield updatePreset({
                    weights: result.weights,
                    lastOptimization: new Date().toISOString(),
                    lastOptimizationReviewCount: result.metrics.reviewCount,
                    lastOptimizationMetrics: result.metrics,
                });
                notify().success(`Optimization complete! RMSE: ${result.metrics.rmse.toFixed(4)}`);
                onRefresh();
            }
            else {
                notify().error("Optimization failed: insufficient data");
            }
        }
        catch (err) {
            notify().error(`Optimization failed: ${String(err)}`);
        }
        finally {
            setOptimizing(false);
        }
    }), [plugin, preset, updatePreset, onRefresh]);
    const handleReset = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        yield updatePreset({
            weights: null,
            lastOptimization: null,
            lastOptimizationReviewCount: null,
            lastOptimizationMetrics: null,
        });
        notify().success("Parameters reset to defaults");
        onRefresh();
    }), [updatePreset, onRefresh]);
    const handleWeightsChange = useCallback((value) => __awaiter(this, void 0, void 0, function* () {
        const trimmed = value.trim();
        if (trimmed === "") {
            yield updatePreset({ weights: null });
            return;
        }
        const parts = trimmed.split(",").map((s) => parseFloat(s.trim()));
        const validLengths = [17, 19, 21];
        if (!validLengths.includes(parts.length)) {
            notify().error(`Invalid weights count: ${parts.length}. Expected 17, 19, or 21 values.`);
            return;
        }
        if (parts.some((n) => Number.isNaN(n))) {
            notify().error("Invalid weights: some values are not numbers.");
            return;
        }
        yield updatePreset({
            weights: parts,
            lastOptimization: new Date().toISOString(),
        });
        notify().success("FSRS weights saved!");
    }), [updatePreset]);
    return (_jsxs(FormCard, { title: "FSRS parameters", children: [_jsxs(InfoBlock, { children: [_jsx("p", { children: "FSRS parameters affect how cards are scheduled. You can optimize them based on your review history." }), _jsxs("p", { children: [_jsx("strong", { children: "Current reviews: " }), presetReviews.toLocaleString(), " ", canOptimize
                                ? "(ready for optimization)"
                                : `(need ${FSRS_CONFIG.minReviewsForOptimization}+ for optimization)`] }), lastOpt && (_jsxs("p", { children: [_jsx("strong", { children: "Last optimized: " }), new Date(lastOpt).toLocaleDateString(), " (", (_d = lastOptCount === null || lastOptCount === void 0 ? void 0 : lastOptCount.toLocaleString()) !== null && _d !== void 0 ? _d : "unknown", " reviews used)"] }))] }), _jsxs(FormField, { name: "Optimize parameters", description: "Analyze your review history to find optimal FSRS weights for this preset", children: [_jsx(ActionButton, { label: optimizing ? "Optimizing..." : "Optimize now", variant: "primary", disabled: !canOptimize || optimizing, onClick: () => void handleOptimize() }), _jsx(ActionButton, { label: "Reset to defaults", variant: "secondary", onClick: () => void handleReset() })] }), _jsx(FormField, { name: "Custom FSRS weights", description: "Enter 17, 19, or 21 comma-separated values (from FSRS optimizer). Leave empty to use defaults", children: _jsx(TextAreaInput, { value: weightsString, onChange: (v) => void handleWeightsChange(v), placeholder: "0.40255, 1.18385, 3.173, 15.69105, ...", rows: 3, class: "ep:w-full ep:font-mono ep:text-ui-small" }) })] }));
}
