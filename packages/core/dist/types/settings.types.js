/**
 * Plugin settings types
 */
/**
 * Extracts FSRS settings from main settings (uses default preset if available,
 * falls back to legacy global fields for backward compatibility)
 */
export function extractFSRSSettings(settings) {
    var _a;
    const defaultPreset = (_a = settings.fsrsPresets) === null || _a === void 0 ? void 0 : _a.find((p) => p.id === settings.defaultPresetId);
    if (defaultPreset) {
        return extractFSRSSettingsFromPreset(defaultPreset);
    }
    return {
        requestRetention: settings.fsrsRequestRetention,
        maximumInterval: settings.fsrsMaximumInterval,
        weights: settings.fsrsWeights,
        learningSteps: settings.learningSteps,
        relearningSteps: settings.relearningSteps,
        enableShortTerm: true,
    };
}
export function extractFSRSSettingsFromPreset(preset) {
    return {
        requestRetention: preset.requestRetention,
        maximumInterval: preset.maximumInterval,
        weights: preset.weights,
        learningSteps: preset.learningSteps,
        relearningSteps: preset.relearningSteps,
        enableShortTerm: true,
    };
}
