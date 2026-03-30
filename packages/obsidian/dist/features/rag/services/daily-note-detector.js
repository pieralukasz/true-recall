const NOT_DAILY = {
    isDailyNote: false,
    date: null,
    displayDate: null,
    dayOfWeek: null,
};
const COMMON_DATE_FORMATS = [
    "YYYY-MM-DD",
    "DD-MM-YYYY",
    "MM-DD-YYYY",
    "YYYY.MM.DD",
    "DD.MM.YYYY",
    "YYYY_MM_DD",
    "YYYYMMDD",
    "D MMMM YYYY",
    "MMMM D, YYYY",
    "DD MMM YYYY",
];
function buildResult(m) {
    return {
        isDailyNote: true,
        date: m.format("YYYY-MM-DD"),
        displayDate: m.format("MMMM D, YYYY"),
        dayOfWeek: m.format("dddd"),
    };
}
function getDailyNotesPluginConfig(app) {
    var _a;
    try {
        const internal = app
            .internalPlugins;
        const plugin = internal === null || internal === void 0 ? void 0 : internal.getPluginById("daily-notes");
        if ((plugin === null || plugin === void 0 ? void 0 : plugin.enabled) && ((_a = plugin.instance) === null || _a === void 0 ? void 0 : _a.options)) {
            const { folder, format } = plugin.instance.options;
            if (folder)
                return { folder, format: format || "YYYY-MM-DD" };
        }
    }
    catch (_b) {
        // Plugin API may not be available
    }
    return null;
}
function tryParseDate(basename, format) {
    const m = window.moment;
    if (!m)
        return null;
    if (format) {
        const parsed = m(basename, format, true);
        if (parsed.isValid())
            return parsed;
    }
    for (const fmt of COMMON_DATE_FORMATS) {
        const parsed = m(basename, fmt, true);
        if (parsed.isValid())
            return parsed;
    }
    return null;
}
/**
 * Detect whether a file is a daily note by checking Obsidian's Daily Notes
 * plugin config, an explicit folder override, or common date filename patterns.
 */
export function detectDailyNote(app, file, dailyNotesFolder) {
    var _a, _b;
    const basename = file.basename;
    const parentPath = (_b = (_a = file.parent) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : "";
    // 1. Explicit folder override from settings
    if (dailyNotesFolder) {
        if (parentPath === dailyNotesFolder ||
            parentPath.startsWith(`${dailyNotesFolder}/`)) {
            const parsed = tryParseDate(basename);
            if (parsed)
                return buildResult(parsed);
        }
        // If folder is set but file isn't in it, not a daily note
        return NOT_DAILY;
    }
    // 2. Obsidian Daily Notes plugin config
    const pluginConfig = getDailyNotesPluginConfig(app);
    if (pluginConfig) {
        const configFolder = pluginConfig.folder.replace(/^\/|\/$/g, "");
        if (parentPath === configFolder ||
            parentPath.startsWith(`${configFolder}/`)) {
            const parsed = tryParseDate(basename, pluginConfig.format);
            if (parsed)
                return buildResult(parsed);
        }
        return NOT_DAILY;
    }
    // 3. Fallback: try parsing filename as date regardless of folder
    const parsed = tryParseDate(basename);
    if (parsed)
        return buildResult(parsed);
    return NOT_DAILY;
}
