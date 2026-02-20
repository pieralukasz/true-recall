export interface SyncResult {
	success: boolean;
	error?: string;
	pulled: number;
	pushed: number;
}

export interface SyncOptions {
	fullSync?: boolean;
}

export interface FirstSyncStatus {
	isFirstSync: boolean;
	hasLocalData: boolean;
	hasRemoteData: boolean;
	hasConflict: boolean;
}
