import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { usePreset, useSettings } from "../hooks/useSettings";
import { AlgorithmSection, BulkOperationsSection, DailyLimitsSection, EasyDaysSection, LoadBalanceSection, ParametersSection, PresetSection, ScheduledBreaksSection, SchedulingSection, SiblingDisperseSection, } from "./fsrs";
import { useApp } from "@true-recall/obsidian/preact";
import { useCallback, useState } from "preact/hooks";
export function FSRSTab({ selectedPresetId, onPresetChange }) {
    const { settings, save, plugin } = useSettings();
    const { preset, updatePreset } = usePreset(selectedPresetId);
    const app = useApp();
    const [version, setVersion] = useState(0);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);
    const presets = settings.fsrsPresets;
    const isDefault = preset.id === settings.defaultPresetId;
    // Force re-read on version changes
    void version;
    // ── Preset CRUD ──
    const handleCreatePreset = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const newPreset = yield plugin.presetService.createPreset({
            name: `${preset.name} (copy)`,
            requestRetention: preset.requestRetention,
            maximumInterval: preset.maximumInterval,
            weights: preset.weights ? [...preset.weights] : null,
            learningSteps: [...preset.learningSteps],
            relearningSteps: [...preset.relearningSteps],
            newCardsPerDay: preset.newCardsPerDay,
            reviewsPerDay: preset.reviewsPerDay,
            lastOptimization: null,
            lastOptimizationReviewCount: null,
            lastOptimizationMetrics: null,
            leechThreshold: preset.leechThreshold,
            leechAction: preset.leechAction,
            newCardOrder: preset.newCardOrder,
            reviewOrder: preset.reviewOrder,
            newReviewMix: preset.newReviewMix,
            burySiblings: preset.burySiblings,
        });
        onPresetChange(newPreset.id);
        refresh();
    }), [plugin, preset, onPresetChange, refresh]);
    const handleDeletePreset = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        yield plugin.presetService.deletePreset(preset.id);
        onPresetChange(settings.defaultPresetId);
        refresh();
    }), [plugin, preset.id, settings.defaultPresetId, onPresetChange, refresh]);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [_jsx(PresetSection, { presets: presets, preset: preset, isDefault: isDefault, selectedPresetId: selectedPresetId, onPresetChange: onPresetChange, onCreate: () => void handleCreatePreset(), onDelete: () => void handleDeletePreset(), onRename: (name) => void updatePreset({ name }) }), _jsx(AlgorithmSection, { preset: preset, updatePreset: updatePreset }), _jsx(DailyLimitsSection, { preset: preset, updatePreset: updatePreset }), _jsx(SchedulingSection, { preset: preset, updatePreset: updatePreset, settings: settings, save: save }), _jsx(ParametersSection, { preset: preset, updatePreset: updatePreset, plugin: plugin, onRefresh: refresh }), _jsx(EasyDaysSection, { plugin: plugin, settings: settings, save: save, app: app, onRefresh: refresh }), _jsx(LoadBalanceSection, { settings: settings, save: save, plugin: plugin }), _jsx(SiblingDisperseSection, { settings: settings, save: save, plugin: plugin }), _jsx(ScheduledBreaksSection, { settings: settings, save: save, onRefresh: refresh }), _jsx(BulkOperationsSection, { plugin: plugin })] }));
}
