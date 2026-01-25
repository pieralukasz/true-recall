/**
 * Sync service types
 */

/**
 * Result of a sync operation
 */
export interface SyncResult {
	success: boolean;
	error?: string;
	pulled: number;
	pushed: number;
}

/**
 * Options for sync operation
 */
export interface SyncOptions {
	/** Force full sync (ignore lastSyncTimestamp) */
	fullSync?: boolean;
}

/**
 * First sync status for conflict detection
 */
export interface FirstSyncStatus {
	/** True if this device has never synced before */
	isFirstSync: boolean;
	/** True if there are local cards/notes */
	hasLocalData: boolean;
	/** True if there are cards/notes on the server */
	hasRemoteData: boolean;
	/** True if both local and remote have data (conflict) */
	hasConflict: boolean;
}
