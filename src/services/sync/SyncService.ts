/**
 * Sync Service
 * Orchestrates cross-device synchronization using Server-Side Merge protocol
 * Client sends operations from sync_log, server returns full rows
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
import type { DatabaseLike } from "../persistence/crsqlite";
import { SyncStateManager } from "./SyncStateManager";
import { SyncTransport } from "./SyncTransport";
import type {
    SyncError,
    SyncResult,
    SyncSettings,
    SyncState,
    SyncStatus,
    SyncOperation,
    SyncPullResponse,
} from "./sync.types";

/**
 * Main sync orchestrator
 */
export class SyncService {
    private db: DatabaseLike;
    private clientId: string;
    private stateManager: SyncStateManager;
    private transport: SyncTransport;
    private settings: SyncSettings;
    private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
    private isSyncing = false;
    private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    constructor(db: DatabaseLike, clientId: string, settings: SyncSettings) {
        this.db = db;
        this.clientId = clientId;
        this.settings = settings;
        this.stateManager = new SyncStateManager(db);
        this.transport = new SyncTransport(settings);
    }

    /**
     * Check if sync is available (server configured)
     */
    canSync(): boolean {
        if (!this.settings.syncEnabled) {
            return false;
        }
        if (!this.settings.syncServerUrl || !this.settings.syncApiKey) {
            return false;
        }
        return true;
    }

    /**
     * Test connection to sync server
     * Returns: { reachable: boolean, authenticated: boolean, error?: string }
     */
    async testConnection(): Promise<{ reachable: boolean; authenticated: boolean; error?: string }> {
        const reachable = await this.transport.healthCheck();
        if (!reachable) {
            return { reachable: false, authenticated: false, error: "Server not reachable" };
        }

        try {
            await this.transport.pullChanges(this.clientId, 0);
            return { reachable: true, authenticated: true };
        } catch (error) {
            const syncError = error as SyncError;
            if (syncError.type === "auth") {
                return { reachable: true, authenticated: false, error: syncError.message };
            }
            return { reachable: true, authenticated: false, error: String(error) };
        }
    }

    /**
     * Get current sync status
     */
    getStatus(): SyncStatus {
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
     * Count pending changes in sync_log
     */
    getPendingChangesCount(): number {
        const result = this.db.exec(`
            SELECT COUNT(*) as count
            FROM sync_log
            WHERE synced = 0
        `);

        if (!result[0] || !result[0].values[0]) return 0;
        return result[0].values[0][0] as number;
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
            const reason = !this.settings.syncEnabled
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
            // 1. Push local changes first
            this.emitProgress("pushing");
            const pushResult = await this.pushChanges();
            pushed = pushResult.pushed;

            // 1.5. Update version after push (BEFORE pull)
            // This ensures pull request uses the correct sinceVersion
            if (pushResult.serverVersion !== undefined) {
                this.stateManager.updateSyncState(pushResult.serverVersion);
            }

            // 2. Pull remote changes
            this.emitProgress("pulling");
            const pullResult = await this.pullChanges();
            pulled = pullResult.applied;

            // 3. Apply remote rows
            if (pullResult.rows || pullResult.deletedIds) {
                this.emitProgress("applying", `${pulled} changes`);
                this.applyServerRows(pullResult);
            }

            // 4. Update state again (final serverVersion from pull)
            this.emitProgress("finalizing");
            this.stateManager.updateSyncState(pullResult.serverVersion);

            // 5. Update pending changes count
            const pendingCount = this.getPendingChangesCount();
            this.stateManager.setPendingChanges(pendingCount);

            const durationMs = Date.now() - startTime;
            this.isSyncing = false;
            this.stateManager.setStatus("idle");

            this.emitCompleted(pulled, pushed, durationMs, manual);

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
     * Get pending operations from sync_log
     */
    private getPendingOperations(): SyncOperation[] {
        const result = this.db.exec(`
            SELECT id, operation, table_name, row_id, data, timestamp
            FROM sync_log
            WHERE synced = 0
            ORDER BY timestamp ASC
        `);

        if (!result[0]) return [];

        const columns = result[0].columns;
        const idIdx = columns.indexOf("id");
        const opIdx = columns.indexOf("operation");
        const tableIdx = columns.indexOf("table_name");
        const rowIdIdx = columns.indexOf("row_id");
        const dataIdx = columns.indexOf("data");
        const timestampIdx = columns.indexOf("timestamp");

        return result[0].values.map((row) => ({
            id: row[idIdx] as string,
            operation: row[opIdx] as "INSERT" | "UPDATE" | "DELETE",
            table: row[tableIdx] as string,
            rowId: row[rowIdIdx] as string,
            data: row[dataIdx] ? JSON.parse(row[dataIdx] as string) : undefined,
            timestamp: row[timestampIdx] as number,
        }));
    }

    /**
     * Mark operations as synced
     */
    private markOperationsSynced(operationIds: string[]): void {
        if (operationIds.length === 0) return;

        const placeholders = operationIds.map(() => "?").join(",");
        this.db.run(
            `UPDATE sync_log SET synced = 1 WHERE id IN (${placeholders})`,
            operationIds
        );
    }

    /**
     * Push local changes to server
     */
    private async pushChanges(): Promise<{
        pushed: number;
        serverVersion: number;
    }> {
        const operations = this.getPendingOperations();

        if (operations.length === 0) {
            return { pushed: 0, serverVersion: this.stateManager.getLastSyncedVersion() };
        }

        const response = await this.transport.pushChanges(this.clientId, operations);

        // Mark successfully pushed operations as synced
        const operationIds = operations.map((op) => op.id);
        this.markOperationsSynced(operationIds);

        return {
            pushed: response.applied,
            serverVersion: response.serverVersion,
        };
    }

    /**
     * Pull changes from server
     */
    private async pullChanges(): Promise<SyncPullResponse & { applied: number }> {
        const sinceVersion = this.stateManager.getLastSyncedVersion();
        const response = await this.transport.pullChanges(this.clientId, sinceVersion);

        // Count total rows pulled
        let applied = 0;
        for (const table of Object.keys(response.rows)) {
            const tableRows = response.rows[table];
            if (tableRows) {
                applied += tableRows.length;
            }
        }
        for (const table of Object.keys(response.deletedIds)) {
            const deletedIds = response.deletedIds[table];
            if (deletedIds) {
                applied += deletedIds.length;
            }
        }

        return { ...response, applied };
    }

    /**
     * Apply server rows to local database
     */
    private applyServerRows(pullResponse: SyncPullResponse): void {
        // Apply upserts for each table
        for (const [table, rows] of Object.entries(pullResponse.rows)) {
            for (const row of rows) {
                this.upsertRow(table, row);
            }
        }

        // Apply deletes for each table
        for (const [table, ids] of Object.entries(pullResponse.deletedIds)) {
            for (const id of ids) {
                // Check if row exists before deleting (deduplication)
                if (this.rowExists(table, id)) {
                    // Row exists, safe to delete
                    this.deleteRow(table, id);
                } else {
                    // Row doesn't exist - skip (already deleted or duplicate)
                    console.log(`[Sync] Skipping deletion for ${table}.${id} - row doesn't exist`);
                }
            }
        }
    }

    /**
     * Upsert a row from server
     */
    private upsertRow(table: string, data: Record<string, unknown>): void {
        const columns = Object.keys(data);
        if (columns.length === 0) return;

        const placeholders = columns.map(() => "?").join(", ");
        const values = columns.map((col) => {
            const val = data[col];
            if (val === undefined) return null;
            return val as string | number | null | Uint8Array;
        });

        // Build ON CONFLICT clause for tables with different PKs
        let pkColumn = "id";
        if (table === "source_notes") {
            pkColumn = "uid";
        } else if (table === "daily_stats") {
            pkColumn = "date";
        } else if (table === "note_projects") {
            // Composite PK
            const setClause = columns
                .filter((c) => c !== "source_uid" && c !== "project_id")
                .map((c) => `"${c}" = excluded."${c}"`)
                .join(", ");

            const sql = `
                INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")})
                VALUES (${placeholders})
                ON CONFLICT(source_uid, project_id) DO UPDATE SET ${setClause || "source_uid = excluded.source_uid"}
            `;
            this.db.run(sql, values);
            return;
        } else if (table === "daily_reviewed_cards") {
            // Composite PK
            const sql = `
                INSERT OR IGNORE INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")})
                VALUES (${placeholders})
            `;
            this.db.run(sql, values);
            return;
        }

        const setClause = columns
            .filter((c) => c !== pkColumn)
            .map((c) => `"${c}" = excluded."${c}"`)
            .join(", ");

        const sql = `
            INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")})
            VALUES (${placeholders})
            ON CONFLICT("${pkColumn}") DO UPDATE SET ${setClause}
        `;

        this.db.run(sql, values);
    }

    /**
     * Check if a row exists in the database
     */
    private rowExists(table: string, rowId: string): boolean {
        try {
            if (table === "note_projects" || table === "daily_reviewed_cards") {
                // Composite PK - rowId is "source_uid:project_id" or "date:card_id"
                const parts = rowId.split(":");
                const first = parts[0] ?? "";
                const second = parts[1] ?? "";

                let sql: string;
                let params: string[];
                if (table === "note_projects") {
                    sql = `SELECT 1 FROM "${table}" WHERE source_uid = ? AND project_id = ? LIMIT 1`;
                    params = [first, second];
                } else {
                    sql = `SELECT 1 FROM "${table}" WHERE date = ? AND card_id = ? LIMIT 1`;
                    params = [first, second];
                }

                const result = this.db.exec(sql, params);
                return !!(result && result[0] && result[0].values.length > 0);
            } else {
                // Simple PK
                let pkColumn = "id";
                if (table === "source_notes") {
                    pkColumn = "uid";
                } else if (table === "daily_stats") {
                    pkColumn = "date";
                }

                const sql = `SELECT 1 FROM "${table}" WHERE "${pkColumn}" = ? LIMIT 1`;
                const result = this.db.exec(sql, [rowId]);
                return !!(result && result[0] && result[0].values.length > 0);
            }
        } catch (e) {
            console.error(`[Sync] Error checking row existence for ${table}.${rowId}:`, e);
            return false; // Assume doesn't exist if check fails
        }
    }

    /**
     * Delete a row from server
     */
    private deleteRow(table: string, rowId: string): void {
        let pkColumn = "id";
        if (table === "source_notes") {
            pkColumn = "uid";
        } else if (table === "daily_stats") {
            pkColumn = "date";
        } else if (table === "note_projects" || table === "daily_reviewed_cards") {
            // Composite PK - rowId is "source_uid:project_id" or "date:card_id"
            const parts = rowId.split(":");
            const first = parts[0] ?? "";
            const second = parts[1] ?? "";
            if (table === "note_projects") {
                this.db.run(`DELETE FROM "${table}" WHERE source_uid = ? AND project_id = ?`, [first, second]);
            } else {
                this.db.run(`DELETE FROM "${table}" WHERE date = ? AND card_id = ?`, [first, second]);
            }
            return;
        }

        this.db.run(`DELETE FROM "${table}" WHERE "${pkColumn}" = ?`, [rowId]);
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

    private emitCompleted(pulled: number, pushed: number, durationMs: number, manual: boolean): void {
        const event: SyncCompletedEvent = {
            type: "sync:completed",
            pulled,
            pushed,
            durationMs,
            manual,
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
