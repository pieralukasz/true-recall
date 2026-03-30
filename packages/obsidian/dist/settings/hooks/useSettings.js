import { __awaiter } from "tslib";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback, useMemo, useState } from "preact/hooks";
export function useSettings() {
    const plugin = usePlugin();
    const [version, setVersion] = useState(0);
    const save = useCallback((patch) => __awaiter(this, void 0, void 0, function* () {
        Object.assign(plugin.settings, patch);
        yield plugin.saveSettings();
        setVersion((v) => v + 1);
    }), [plugin]);
    // Re-read settings on every version bump to trigger re-render
    void version;
    return { settings: plugin.settings, save, plugin };
}
export function usePreset(selectedPresetId) {
    const plugin = usePlugin();
    const [version, setVersion] = useState(0);
    const preset = useMemo(() => {
        var _a;
        void version;
        const presets = plugin.settings.fsrsPresets;
        const found = (_a = presets.find((p) => p.id === selectedPresetId)) !== null && _a !== void 0 ? _a : presets[0];
        if (!found)
            throw new Error("No FSRS presets configured");
        return found;
    }, [plugin.settings.fsrsPresets, selectedPresetId, version]);
    const updatePreset = useCallback((changes) => __awaiter(this, void 0, void 0, function* () {
        yield plugin.presetService.updatePreset(preset.id, changes);
        setVersion((v) => v + 1);
    }), [plugin, preset.id]);
    return { preset, updatePreset };
}
