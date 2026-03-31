/**
 * Import Studio types.
 */
export const IMPORT_STUDIO_PREFS_KEY = "true-recall:import-studio-prefs";
export function loadImportStudioPrefs(app) {
    try {
        const raw = app.loadLocalStorage(IMPORT_STUDIO_PREFS_KEY);
        if (raw)
            return JSON.parse(raw);
    }
    catch (_a) {
        // ignore
    }
    return {
        lastNoteTypeId: "builtin-basic",
        lastSourceNotePath: "",
    };
}
export function saveImportStudioPrefs(app, prefs) {
    const current = loadImportStudioPrefs(app);
    app.saveLocalStorage(IMPORT_STUDIO_PREFS_KEY, JSON.stringify(Object.assign(Object.assign({}, current), prefs)));
}
