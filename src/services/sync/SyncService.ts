/**
 * Sync Service
 * Orchestrates cross-device synchronization using CR-SQLite CRDTs
 */
import { SYNC_CONFIG } from "../../constants";
import type {
    SyncStartedEvent,
    SyncCompletedEvent,
    SyncFailedEvent,
    SyncProgressEvent,
    SyncPhase,
} from "../../types/events.types";
import { getEventBus } from "../core/event-bus.service";
import {
    getChangesSince,
    applyChanges,
    getDbVersion,
    isCrSqliteAvailable,
    type DatabaseLike,
    type CrsqlChange,
} from "../persistence/crsqlite";
import { SyncStateManager } from "./SyncStateManager";
import { SyncTransport } from "./SyncTransport";
import type { SyncError, SyncResult, SyncSettings, SyncState, SyncStatus } from "./sync.types";

/**
 * Main sync orchestrator
 */
export class SyncService {
    private db: DatabaseLike;
    private siteId: string;
    private stateManager: SyncStateManager;
    private transport: SyncTransport;
    private settings: SyncSettings;
    private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
    private isSyncing = false;
    private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(db: DatabaseLike, siteId: string, settings: SyncSettings) {
        this.db = db;
        this.siteId = siteId;
        this.settings = settings;
        this.stateManager = new SyncStateManager(db);
        this.transport = new SyncTransport(settings);
    }

    /**
     * Check if sync is available (CR-SQLite loaded and configured)
     */
    canSync(): boolean {
        if (!isCrSqliteAvailable()) {
            return false;
        }
        if (!this.settings.syncEnabled) {
            return false;
        }
        if (!this.settings.syncServerUrl || !this.settings.syncApiKey) {
            return false;
        }
        return true;
    }

    /**
     * Get current sync status
     */
    getStatus(): SyncStatus {
        if (!isCrSqliteAvailable()) {
            return "no-crsqlite";
        }
        if (!this.settings.syncEnabled) {
            return "disabled";
        }
        if (this.isSyncing) {
            return "syncing";
        }
        const state = this.stateManager.getState();
        return state.status;
    }

    /**
     * Get full sync state
     */
    getState(): SyncState {
        return this.stateManager.getState();
    }

    /**
     * Update settings (when user changes them)
     */
    updateSettings(settings: SyncSettings): void {
        this.settings = settings;
        this.transport.updateSettings(settings);

        // Restart auto-sync if settings changed
        if (settings.autoSyncEnabled && settings.syncEnabled && settings.syncIntervalMinutes > 0) {
            this.startAutoSync();
        } else {
            this.stopAutoSync();
        }
    }

    /**
     * Perform a sync operation
     * @param manual Whether this was triggered manually (affects retry behavior)
     */
    async sync(manual = false): Promise<SyncResult> {
        const startTime = Date.now();

        // Check preconditions
        if (!this.canSync()) {
            const reason = !isCrSqliteAvailable()
                ? "CR-SQLite not available"
                : !this.settings.syncEnabled
                  ? "Sync disabled"
                  : "Server not configured";

            return {
                success: false,
                pulled: 0,
                pushed: 0,
                durationMs: 0,
                error: reason,
            };
        }

        // Prevent concurrent syncs
        if (this.isSyncing) {
            return {
                success: false,
                pulled: 0,
                pushed: 0,
                durationMs: 0,
                error: "Sync already in progress",
            };
        }

        this.isSyncing = true;
        this.stateManager.setStatus("syncing");
        this.emitStarted(manual);

        let pulled = 0;
        let pushed = 0;

        try {
            // 1. Pull remote changes
            this.emitProgress("pulling");
            const pullResult = await this.pullChanges();
            pulled = pullResult.applied;

            // 2. Apply remote changes
            if (pullResult.changes.length > 0) {
                this.emitProgress("applying", `${pullResult.changes.length} changes`);
                applyChanges(this.db, pullResult.changes);
            }

            // 3. Push local changes
            this.emitProgress("pushing");
            const pushResult = await this.pushChanges(pullResult.serverVersion);
            pushed = pushResult.pushed;

            // 4. Update state
            this.emitProgress("finalizing");
            const finalVersion = Math.max(pullResult.serverVersion, getDbVersion(this.db));
            this.stateManager.updateSyncState(finalVersion);

            const durationMs = Date.now() - startTime;
            this.isSyncing = false;
            this.stateManager.setStatus("idle");

            this.emitCompleted(pulled, pushed, durationMs);

            return {
                success: true,
                pulled,
                pushed,
                durationMs,
            };
        } catch (error) {
            const syncError = this.toSyncError(error);
            this.stateManager.recordError(syncError.message);
            this.stateManager.setStatus("error");
            this.isSyncing = false;

            const durationMs = Date.now() - startTime;

            // Handle retry logic
            if (syncError.retryable && !manual) {
                const state = this.stateManager.getState();
                const attempt = state.retryCount + 1;

                if (attempt <= SYNC_CONFIG.maxRetries) {
                    const delay = SyncTransport.calculateRetryDelay(attempt);
                    this.stateManager.setRetryInfo(attempt, Date.now() + delay);
                    this.scheduleRetry(delay);
                    this.emitFailed(syncError.message, delay, attempt);
                } else {
                    this.emitFailed(syncError.message, null, attempt);
                }
            } else {
                this.emitFailed(syncError.message, null, 0);
            }

            return {
                success: false,
                pulled,
                pushed,
                durationMs,
                error: syncError.message,
            };
        }
    }

    /**
     * Start automatic background sync
     */
    startAutoSync(): void {
        this.stopAutoSync(); // Clear any existing interval

        if (!this.settings.autoSyncEnabled || this.settings.syncIntervalMinutes <= 0) {
            return;
        }

        const intervalMs = this.settings.syncIntervalMinutes * 60 * 1000;
        console.log(`[Episteme] Starting auto-sync every ${this.settings.syncIntervalMinutes} minutes`);

        this.autoSyncInterval = setInterval(() => {
            if (!this.isSyncing) {
                this.sync(false).catch((e) => {
                    console.warn("[Episteme] Auto-sync failed:", e);
                });
            }
        }, intervalMs);
    }

    /**
     * Stop automatic background sync
     */
    stopAutoSync(): void {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
            console.log("[Episteme] Auto-sync stopped");
        }
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.stopAutoSync();
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
            this.retryTimeoutId = null;
        }
    }

    // ===== Private Methods =====

    /**
     * Pull changes from server
     */
    private async pullChanges(): Promise<{
        changes: CrsqlChange[];
        applied: number;
        serverVersion: number;
    }> {
        const sinceVersion = this.stateManager.getLastSyncedVersion();
        const response = await this.transport.pullChanges(this.siteId, sinceVersion);

        // Deserialize wire format to CrsqlChange
        const changes = response.changes.map((wire) => this.transport.deserializeChange(wire));

        return {
            changes,
            applied: changes.length,
            serverVersion: response.serverVersion,
        };
    }

    /**
     * Push local changes to server
     */
    private async pushChanges(sinceVersion: number): Promise<{
        pushed: number;
        serverVersion: number;
    }> {
        // Get local changes since last synced version
        const localChanges = getChangesSince(this.db, sinceVersion);

        if (localChanges.length === 0) {
            return { pushed: 0, serverVersion: sinceVersion };
        }

        const response = await this.transport.pushChanges(
            this.siteId,
            localChanges,
            getDbVersion(this.db)
        );

        return {
            pushed: response.accepted,
            serverVersion: response.serverVersion,
        };
    }

    /**
     * Schedule a retry after a delay
     */
    private scheduleRetry(delayMs: number): void {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
        }

        this.retryTimeoutId = setTimeout(() => {
            this.retryTimeoutId = null;
            if (this.canSync() && !this.isSyncing) {
                this.sync(false).catch((e) => {
                    console.warn("[Episteme] Retry sync failed:", e);
                });
            }
        }, delayMs);
    }

    /**
     * Convert unknown error to SyncError
     */
    private toSyncError(error: unknown): SyncError {
        if (error && typeof error === "object" && "type" in error) {
            return error as SyncError;
        }

        const message = error instanceof Error ? error.message : String(error);

        // Check for network-related errors
        const isNetworkError =
            message.includes("network") ||
            message.includes("fetch") ||
            message.includes("ECONNREFUSED");

        return {
            type: isNetworkError ? "network" : "unknown",
            message,
            retryable: isNetworkError,
        };
    }

    // ===== Event Emitters =====

    private emitStarted(manual: boolean): void {
        const event: SyncStartedEvent = {
            type: "sync:started",
            manual,
            timestamp: Date.now(),
        };
        getEventBus().emit(event);
    }

    private emitCompleted(pulled: number, pushed: number, durationMs: number): void {
        const event: SyncCompletedEvent = {
            type: "sync:completed",
            pulled,
            pushed,
            durationMs,
            timestamp: Date.now(),
        };
        getEventBus().emit(event);
    }

    private emitFailed(error: string, retryIn: number | null, attempt: number): void {
        const event: SyncFailedEvent = {
            type: "sync:failed",
            error,
            retryIn,
            attempt,
            timestamp: Date.now(),
        };
        getEventBus().emit(event);
    }

    private emitProgress(phase: SyncPhase, detail?: string): void {
        const event: SyncProgressEvent = {
            type: "sync:progress",
            phase,
            detail,
            timestamp: Date.now(),
        };
        getEventBus().emit(event);
    }
}
