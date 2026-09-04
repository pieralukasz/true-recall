export const CLOUD_ENTITY_TYPES = [
	"note_type",
	"note",
	"card",
	"review_log",
] as const;

export type CloudEntityType = (typeof CLOUD_ENTITY_TYPES)[number];

export interface CloudSyncChange {
	entityType: CloudEntityType;
	entityId: string;
	updatedAt: number;
	payload: Record<string, unknown>;
	/** Present on server responses; the server derives it from the device token. */
	sourceDeviceId?: string;
}

export interface CloudSyncExchangeRequest {
	cursor: number;
	changes: CloudSyncChange[];
}

export interface CloudSyncExchangeResponse {
	changes: CloudSyncChange[];
	cursor: number;
	hasMore: boolean;
}

export interface CloudSyncTransport {
	exchange(
		request: CloudSyncExchangeRequest,
	): Promise<CloudSyncExchangeResponse>;
}

export interface CloudSyncResult {
	pulled: number;
	pushed: number;
	cardIdsChanged: string[];
	reviewLogsApplied: number;
	conflictsReplayed: number;
	duplicatesMerged: number;
	/** Rows still parked because their parent has not arrived yet. */
	deferred: number;
	errors: string[];
}
