const TYPE_IN_MODE_STORAGE_KEY = "true-recall.review.type-in-mode";
export function getTypeInModeStorage() {
    if (typeof window === "undefined")
        return null;
    try {
        return window.localStorage;
    }
    catch (_a) {
        return null;
    }
}
const VALID_MODES = new Set(["off", "ai", "diff"]);
export function readPersistedTypeInMode(storage) {
    if (!storage)
        return null;
    try {
        const value = storage.getItem(TYPE_IN_MODE_STORAGE_KEY);
        if (value && VALID_MODES.has(value))
            return value;
        return null;
    }
    catch (_a) {
        return null;
    }
}
export function persistTypeInMode(storage, mode) {
    if (!storage)
        return;
    try {
        storage.setItem(TYPE_IN_MODE_STORAGE_KEY, mode);
    }
    catch (_a) {
        // Ignore storage write failures (private mode / platform restrictions).
    }
}
