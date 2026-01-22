/**
 * CRR (Conflict-free Replicated Relations) Initializer
 *
 * NOTE: CR-SQLite is now disabled on the client. This module is kept for compatibility.
 * Sync now uses Server-Side Merge protocol where the server handles CRDT logic.
 * See SyncService.ts for the new sync implementation.
 */
import type { DatabaseLike } from "./CrSqliteLoader";

/**
 * Tables that participate in sync
 * These tables contain user data that is synchronized across devices
 */
export const CRR_TABLES = [
    "cards",
    "source_notes",
    "projects",
    "note_projects",
    "review_log",
    "daily_stats",
    "daily_reviewed_cards",
    "card_image_refs",
] as const;

/**
 * Tables that are NOT synced (local-only)
 */
export const LOCAL_ONLY_TABLES = ["meta", "sync_log"] as const;

/**
 * Initialize CRR tables - NO-OP since CR-SQLite is disabled on client
 * @deprecated Use Server-Side Merge protocol instead
 */
export function initializeCrrs(_db: DatabaseLike): number {
    console.log("[Episteme] CRR initialization skipped - using Server-Side Merge protocol");
    return 0;
}

/**
 * Check if CRRs are enabled - always returns false
 * @deprecated CR-SQLite is disabled on client
 */
export function isCrrEnabled(_db: DatabaseLike): boolean {
    return false;
}

/**
 * Get database version - returns 0 since CR-SQLite is disabled
 * @deprecated Use sync_log and server version tracking instead
 */
export function getDbVersion(_db: DatabaseLike): number {
    return 0;
}

/**
 * Get site ID - returns null since CR-SQLite is disabled
 * @deprecated Client ID is now managed separately
 */
export function getSiteId(_db: DatabaseLike): string | null {
    return null;
}

/**
 * CR-SQLite change format (kept for type compatibility)
 * @deprecated No longer used - sync uses SyncOperation from sync.types.ts
 */
export interface CrsqlChange {
    table: string;
    pk: Uint8Array;
    cid: string;
    val: unknown;
    colVersion: number;
    dbVersion: number;
    siteId: Uint8Array;
    cl: number;
    seq: number;
}

/**
 * Get changes since version - returns empty array since CR-SQLite is disabled
 * @deprecated Use sync_log table instead
 */
export function getChangesSince(_db: DatabaseLike, _sinceVersion: number): CrsqlChange[] {
    return [];
}

/**
 * Apply changes from another device - NO-OP since CR-SQLite is disabled
 * @deprecated Server-Side Merge handles this through SyncService.applyServerRows()
 */
export function applyChanges(_db: DatabaseLike, _changes: CrsqlChange[]): number {
    return 0;
}
