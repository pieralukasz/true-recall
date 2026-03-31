export const DB_FOLDER = ".true-recall";
export const DB_FILE = "true-recall.db"; // legacy single-device database
export const DB_FILE_PREFIX = "true-recall-";
export const DB_FILE_SUFFIX = ".db";
export const LEGACY_DB_FILE = "true-recall.db";
export const SAVE_DEBOUNCE_MS = 5000; // 5 seconds - better durability on app shutdown
export const SAFETY_FLUSH_INTERVAL_MS = 15000; // hard safety flush every 15 seconds
/**
 * Get the database filename for a specific device.
 * @param deviceId - 8-character alphanumeric device identifier
 * @returns Filename like "true-recall-a1b2c3d4.db"
 */
export function getDeviceDbFilename(deviceId) {
    return `${DB_FILE_PREFIX}${deviceId}${DB_FILE_SUFFIX}`;
}
/**
 * Extract device ID from a device-specific database filename.
 * @param filename - Filename like "true-recall-a1b2c3d4.db"
 * @returns Device ID or null if not a valid device database filename
 */
export function extractDeviceIdFromFilename(filename) {
    var _a;
    const match = filename.match(/^true-recall-([a-z0-9]{8})\.db$/);
    return (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : null;
}
/**
 * Convert Uint8Array to exact-size ArrayBuffer (respecting byteOffset/byteLength).
 */
export function toExactArrayBuffer(bytes) {
    if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
        return bytes.buffer;
    }
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
/**
 * Safely extract query result from database exec
 */
export function getQueryResult(result) {
    const firstResult = result[0];
    if (!firstResult || !firstResult.values || firstResult.values.length === 0) {
        return null;
    }
    return {
        columns: firstResult.columns,
        values: firstResult.values,
    };
}
/**
 * Generate a UUID v4 string
 * Uses crypto.randomUUID() if available, otherwise falls back to manual generation
 */
export function generateUUID() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
/**
 * SQL fragment constants for soft delete filtering
 */
export const NOT_DELETED = {
    cards: "deleted_at IS NULL",
    cardsAlias: "c.deleted_at IS NULL",
    reviewLog: "deleted_at IS NULL",
    reviewLogAlias: "rl.deleted_at IS NULL",
    projects: "deleted_at IS NULL",
    projectsAlias: "p.deleted_at IS NULL",
    noteProjects: "deleted_at IS NULL",
    noteProjectsAlias: "np.deleted_at IS NULL",
    sourceNotes: "deleted_at IS NULL",
    sourceNotesAlias: "s.deleted_at IS NULL",
    cardImageRefs: "deleted_at IS NULL",
};
