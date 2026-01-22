/**
 * Sync Types
 * TypeScript interfaces for cross-device synchronization via CR-SQLite
 */

/**
 * Wire format for CR-SQLite changes (sent over HTTP)
 * Binary fields (pk, siteId) are hex-encoded for JSON transport
 */
export interface CrsqlChangeWire {
    table: string;
    pk: string; // Hex-encoded primary key
    cid: string; // Column ID
    val: unknown; // Column value
    colVersion: number;
    dbVersion: number;
    siteId: string; // Hex-encoded site ID
    cl: number; // Causal length
    seq: number; // Sequence number
}

/**
 * Request to pull changes from server
 */
export interface SyncPullRequest {
    siteId: string;
    sinceVersion: number;
}

/**
 * Response from server with remote changes
 */
export interface SyncPullResponse {
    changes: CrsqlChangeWire[];
    serverVersion: number;
    hasMore: boolean;
}

/**
 * Request to push local changes to server
 */
export interface SyncPushRequest {
    siteId: string;
    changes: CrsqlChangeWire[];
    clientVersion: number;
}

/**
 * Response from server after pushing changes
 */
export interface SyncPushResponse {
    serverVersion: number;
    accepted: number;
    rejected: number;
}

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
    | "offline"
    | "no-crsqlite";

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
}
