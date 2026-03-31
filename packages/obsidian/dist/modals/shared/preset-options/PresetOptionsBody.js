import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import { DailyLimitsSection } from "./DailyLimitsSection";
import { LapsesSection } from "./LapsesSection";
import { NewCardsSection } from "./NewCardsSection";
import { ParametersSection } from "./ParametersSection";
import { PresetSelector } from "./PresetSelector";
import { SchedulingSection } from "./SchedulingSection";
import { UsageSection } from "./UsageSection";
export function PresetOptionsBody({ initialPresetId, context, onClose, }) {
    var _a;
    const plugin = usePlugin();
    const settings = plugin.settings;
    const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId !== null && initialPresetId !== void 0 ? initialPresetId : settings.defaultPresetId);
    const [version, setVersion] = useState(0);
    const [applyToChildren, setApplyToChildren] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const hasChildren = useMemo(() => {
        if (!(context === null || context === void 0 ? void 0 : context.contextPath))
            return false;
        return (plugin.hierarchyService.getChildPaths(context.contextPath).length > 0);
    }, [plugin, context === null || context === void 0 ? void 0 : context.contextPath]);
    const getDescendantProjectPaths = useCallback((rootPath) => {
        const result = [];
        const visited = new Set();
        const collect = (path) => {
            for (const child of plugin.hierarchyService.getChildPaths(path)) {
                if (visited.has(child))
                    continue;
                visited.add(child);
                const isProject = plugin.hierarchyService.getChildPaths(child).length > 0;
                if (isProject) {
                    result.push(child);
                    collect(child);
                }
            }
        };
        collect(rootPath);
        return result;
    }, [plugin]);
    // Re-read on version bump
    void version;
    const presets = settings.fsrsPresets;
    const preset = (_a = presets.find((p) => p.id === selectedPresetId)) !== null && _a !== void 0 ? _a : presets[0];
    if (!preset)
        return null;
    const isDefault = preset.id === settings.defaultPresetId;
    const updatePreset = useCallback((changes) => __awaiter(this, void 0, void 0, function* () {
        yield plugin.presetService.updatePreset(preset.id, changes);
        setVersion((v) => v + 1);
    }), [plugin, preset.id]);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);
    const handleCreate = useCallback(() => __awaiter(this, void 0, void 0, function* () {
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
        });
        setSelectedPresetId(newPreset.id);
        refresh();
    }), [plugin, preset, refresh]);
    const handleDelete = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        yield plugin.presetService.deletePreset(preset.id);
        setSelectedPresetId(settings.defaultPresetId);
        refresh();
    }), [plugin, preset.id, settings.defaultPresetId, refresh]);
    const handleDone = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        const frontmatterService = (_a = plugin.flashcardManager) === null || _a === void 0 ? void 0 : _a.getFrontmatterService();
        if ((context === null || context === void 0 ? void 0 : context.contextPath) && frontmatterService) {
            const file = plugin.app.vault.getFileByPath(context.contextPath);
            if (file) {
                yield frontmatterService.setFsrsPreset(file.path, preset.name);
            }
            if (applyToChildren) {
                const descendantPaths = getDescendantProjectPaths(context.contextPath);
                setIsApplying(true);
                try {
                    yield Promise.all(descendantPaths.map((path) => {
                        const f = plugin.app.vault.getFileByPath(path);
                        return f
                            ? frontmatterService.setFsrsPreset(f.path, preset.name)
                            : Promise.resolve();
                    }));
                }
                finally {
                    onClose();
                }
                return;
            }
        }
        onClose();
    }), [
        plugin,
        context,
        preset.name,
        onClose,
        applyToChildren,
        getDescendantProjectPaths,
    ]);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:flex-1 ep:min-h-0", children: [_jsxs("div", { class: "ep:flex-1 ep:overflow-y-auto ep:min-h-0", children: [_jsx(PresetSelector, { presets: presets, preset: preset, isDefault: isDefault, onPresetChange: setSelectedPresetId, onCreate: () => void handleCreate(), onDelete: () => void handleDelete(), onRename: (name) => void updatePreset({ name }) }), _jsx(DailyLimitsSection, { preset: preset, updatePreset: updatePreset }), _jsx(NewCardsSection, { preset: preset, updatePreset: updatePreset }), _jsx(LapsesSection, { preset: preset, updatePreset: updatePreset }), _jsx(SchedulingSection, { preset: preset, updatePreset: updatePreset }), _jsx(ParametersSection, { preset: preset, updatePreset: updatePreset, plugin: plugin, onRefresh: refresh }), _jsx(UsageSection, { preset: preset })] }), _jsxs("div", { class: "ep-modal-footer ep:flex ep:items-center ep:justify-between ep:gap-2 ep:pt-3 ep:mt-2 ep:border-t ep:border-obs-border", children: [hasChildren && (context === null || context === void 0 ? void 0 : context.contextPath) ? (_jsxs("label", { class: "ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-small ep:text-obs-muted", children: [_jsx("input", { type: "checkbox", checked: applyToChildren, disabled: isApplying, onChange: (e) => setApplyToChildren(e.target.checked) }), "Apply to child projects"] })) : (_jsx("div", {})), _jsx(Clickable, { class: "ep-btn mod-cta ep:text-ui-small", onClick: () => void handleDone(), stopPropagation: false, disabled: isApplying, children: isApplying ? "Applying..." : "Done" })] })] }));
}
