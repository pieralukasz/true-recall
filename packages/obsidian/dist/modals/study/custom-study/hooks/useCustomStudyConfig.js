import { useCallback, useState } from "preact/hooks";
const DEFAULT_CONFIG = {
    stateFilter: "all",
    difficultyMin: 1,
    difficultyMax: 10,
    lapsesMin: 0,
    reviewOrder: "due-date",
    cardLimit: 0,
    studyAheadDays: 0,
    crammingMode: false,
};
export function useCustomStudyConfig() {
    const [config, setConfig] = useState(Object.assign({}, DEFAULT_CONFIG));
    const updateConfig = useCallback((key, value) => {
        setConfig((prev) => (Object.assign(Object.assign({}, prev), { [key]: value })));
    }, []);
    const buildResult = useCallback((presetName) => {
        const hasDifficultyFilter = config.difficultyMin > 1 || config.difficultyMax < 10;
        const hasLapsesFilter = config.lapsesMin > 0;
        const sessionResult = {
            cancelled: false,
            sessionType: "custom-study",
            ignoreDailyLimits: true,
            bypassScheduling: true,
            reviewOrder: config.reviewOrder,
            stateFilter: config.stateFilter === "all" ? undefined : config.stateFilter,
            difficultyRange: hasDifficultyFilter
                ? { min: config.difficultyMin, max: config.difficultyMax }
                : undefined,
            lapsesRange: hasLapsesFilter
                ? { min: config.lapsesMin, max: Infinity }
                : undefined,
            cardLimit: config.cardLimit > 0 ? config.cardLimit : undefined,
            studyAheadDays: config.studyAheadDays > 0 ? config.studyAheadDays : undefined,
            crammingMode: config.crammingMode || undefined,
        };
        const result = {
            cancelled: false,
            sessionResult,
        };
        if (presetName) {
            result.saveAsPreset = true;
            result.presetName = presetName;
        }
        return result;
    }, [config]);
    return { config, updateConfig, buildResult };
}
