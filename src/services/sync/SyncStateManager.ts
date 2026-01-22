/**
 * Sync State Manager
 * Persists sync state to the meta table in SQLite
 */
import type { DatabaseLike } from "../persistence/crsqlite";
import { getQueryResult } from "../persistence/sqlite/sqlite.types";
import type { SyncMetaKeys, SyncState, SyncStatus } from "./sync.types";

/**
 * Meta table keys for sync state
 */
const META_KEYS = {
    lastSyncedVersion: "sync_last_version",
    lastSyncTime: "sync_last_time",
    lastSyncError: "sync_last_error",
} as const;

/**
 * Manages sync state persistence in the meta table
 */
export class SyncStateManager {
    private db: DatabaseLike;
    private inMemoryState: Partial<SyncState>;

    constructor(db: DatabaseLike) {
        this.db = db;
        this.inMemoryState = {
            status: "idle",
            retryCount: 0,
            nextRetryTime: null,
            pendingChanges: 0,
        };
    }

    /**
     * Get the last synced database version
     */
    getLastSyncedVersion(): number {
        try {
            const result = this.db.exec(
                `SELECT value FROM meta WHERE key = '${META_KEYS.lastSyncedVersion}'`
            );
            const data = getQueryResult(result);
            if (data && data.values.length > 0) {
                const row = data.values[0];
                if (row && row[0] !== undefined) {
                    return parseInt(row[0] as string, 10) || 0;
                }
            }
        } catch (e) {
            console.warn("[Episteme] Failed to get lastSyncedVersion:", e);
        }
        return 0;
    }

    /**
     * Get the last sync time (Unix timestamp in ms)
     */
    getLastSyncTime(): number | null {
        try {
            const result = this.db.exec(
                `SELECT value FROM meta WHERE key = '${META_KEYS.lastSyncTime}'`
            );
            const data = getQueryResult(result);
            if (data && data.values.length > 0) {
                const row = data.values[0];
                if (row && row[0] !== undefined) {
                    const value = parseInt(row[0] as string, 10);
                    return isNaN(value) ? null : value;
                }
            }
        } catch (e) {
            console.warn("[Episteme] Failed to get lastSyncTime:", e);
        }
        return null;
    }

    /**
     * Get the last sync error message
     */
    getLastSyncError(): string | null {
        try {
            const result = this.db.exec(
                `SELECT value FROM meta WHERE key = '${META_KEYS.lastSyncError}'`
            );
            const data = getQueryResult(result);
            if (data && data.values.length > 0) {
                const row = data.values[0];
                if (row && row[0] !== undefined) {
                    const value = row[0] as string;
                    return value === "" ? null : value;
                }
            }
        } catch (e) {
            console.warn("[Episteme] Failed to get lastSyncError:", e);
        }
        return null;
    }

    /**
     * Update sync state after successful sync
     */
    updateSyncState(version: number): void {
        const now = Date.now();
        try {
            this.db.run(
                `INSERT OR REPLACE INTO meta (key, value) VALUES ('${META_KEYS.lastSyncedVersion}', ?)`,
                [String(version)]
            );
            this.db.run(
                `INSERT OR REPLACE INTO meta (key, value) VALUES ('${META_KEYS.lastSyncTime}', ?)`,
                [String(now)]
            );
            // Clear any previous error on success
            this.db.run(
                `INSERT OR REPLACE INTO meta (key, value) VALUES ('${META_KEYS.lastSyncError}', '')`,
            );
            this.inMemoryState.lastError = null;
            this.inMemoryState.retryCount = 0;
            this.inMemoryState.nextRetryTime = null;
        } catch (e) {
            console.error("[Episteme] Failed to update sync state:", e);
        }
    }

    /**
     * Record a sync error
     */
    recordError(error: string): void {
        try {
            this.db.run(
                `INSERT OR REPLACE INTO meta (key, value) VALUES ('${META_KEYS.lastSyncError}', ?)`,
                [error]
            );
            this.inMemoryState.lastError = error;
        } catch (e) {
            console.error("[Episteme] Failed to record sync error:", e);
        }
    }

    /**
     * Set the current sync status (in-memory only)
     */
    setStatus(status: SyncStatus): void {
        this.inMemoryState.status = status;
    }

    /**
     * Set retry information (in-memory only)
     */
    setRetryInfo(retryCount: number, nextRetryTime: number | null): void {
        this.inMemoryState.retryCount = retryCount;
        this.inMemoryState.nextRetryTime = nextRetryTime;
    }

    /**
     * Set pending changes count (in-memory only)
     */
    setPendingChanges(count: number): void {
        this.inMemoryState.pendingChanges = count;
    }

    /**
     * Get the full sync state
     */
    getState(): SyncState {
        return {
            status: this.inMemoryState.status ?? "idle",
            lastSyncTime: this.getLastSyncTime(),
            lastSyncedVersion: this.getLastSyncedVersion(),
            lastError: this.inMemoryState.lastError ?? this.getLastSyncError(),
            pendingChanges: this.inMemoryState.pendingChanges ?? 0,
            retryCount: this.inMemoryState.retryCount ?? 0,
            nextRetryTime: this.inMemoryState.nextRetryTime ?? null,
        };
    }

    /**
     * Load all persisted sync meta values
     */
    loadPersistedState(): SyncMetaKeys {
        return {
            lastSyncedVersion: this.getLastSyncedVersion(),
            lastSyncTime: this.getLastSyncTime(),
            lastSyncError: this.getLastSyncError(),
        };
    }

    /**
     * Clear all sync state (for testing or reset)
     */
    clearState(): void {
        try {
            this.db.run(`DELETE FROM meta WHERE key LIKE 'sync_%'`);
            this.inMemoryState = {
                status: "idle",
                retryCount: 0,
                nextRetryTime: null,
                pendingChanges: 0,
            };
        } catch (e) {
            console.error("[Episteme] Failed to clear sync state:", e);
        }
    }
}
