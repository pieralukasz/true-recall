/**
 * Sync Types
 * TypeScript interfaces for cross-device synchronization (Server-Side Merge)
 */

// =============================================================================
// Sync Operations (Client -> Server)
// =============================================================================

/**
 * A single sync operation representing a change to be pushed to the server
 */
export interface SyncOperation {
    id: string;
    operation: "INSERT" | "UPDATE" | "DELETE";
    table: string;
    rowId: string;
    data: Record<string, unknown> | null;
    timestamp: number;
}

/**
 * Request to push local changes to server
 */
export interface SyncPushRequest {
    clientId: string;
    operations: SyncOperation[];
}

/**
 * Response from server after pushing changes
 */
export interface SyncPushResponse {
    applied: number;
    errors?: number;
    serverVersion: number;
}

// =============================================================================
// Sync Pull (Server -> Client)
// =============================================================================

/**
 * Response from server with rows modified since last sync
 */
export interface SyncPullResponse {
    rows: Record<string, Record<string, unknown>[]>;
    deletedIds: Record<string, string[]>;
    serverVersion: number;
}

// =============================================================================
// Sync State & Status
// =============================================================================

/**
 * Result of a sync operation
 */
export interface SyncResult {
    success: boolean;
    pulled: number;
    pushed: number;
    durationMs: number;
    error?: string;
}

/**
 * Sync operation status
 */
export type SyncStatus =
    | "idle"
    | "syncing"
    | "error"
    | "disabled"
    | "offline";

/**
 * Full sync state including metadata
 */
export interface SyncState {
    status: SyncStatus;
    lastSyncTime: number | null;
    lastSyncedVersion: number;
    lastError: string | null;
    pendingChanges: number;
    retryCount: number;
    nextRetryTime: number | null;
}

/**
 * Sync settings subset from EpistemeSettings
 */
export interface SyncSettings {
    syncEnabled: boolean;
    syncServerUrl: string;
    syncApiKey: string;
    syncIntervalMinutes: number;
    autoSyncEnabled: boolean;
}

/**
 * Error types for sync operations
 */
export type SyncErrorType =
    | "network"
    | "auth"
    | "server"
    | "conflict"
    | "timeout"
    | "unknown";

/**
 * Structured sync error
 */
export interface SyncError {
    type: SyncErrorType;
    message: string;
    statusCode?: number;
    retryable: boolean;
}

/**
 * Meta table key-value pairs for sync state persistence
 */
export interface SyncMetaKeys {
    lastSyncedVersion: number;
    lastSyncTime: number | null;
    lastSyncError: string | null;
    clientId: string | null;
}

// =============================================================================
// Tables that are synced
// =============================================================================

/**
 * List of tables that participate in sync
 */
export const SYNC_TABLES = [
    "cards",
    "source_notes",
    "projects",
    "note_projects",
    "review_log",
    "daily_stats",
    "daily_reviewed_cards",
    "card_image_refs",
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];
