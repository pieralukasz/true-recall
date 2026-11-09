export const CLOUD_ENTITY_TYPES = [
	"note_type",
	"note",
	"card",
	"review_log",
	"card_child",
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
	/**
	 * Entity types this client can apply. A server that stores newer types
	 * than the original four must send only these back, because older
	 * clients reject a response with a type they do not know.
	 */
	entityTypes?: readonly CloudEntityType[];
}

export interface CloudSyncExchangeResponse {
	changes: CloudSyncChange[];
	cursor: number;
	hasMore: boolean;
	/**
	 * Entity types the server accepts in a push. Servers that predate this
	 * field accept only the original four and reject the whole batch when it
	 * holds any other type, so newer types are pushed only once listed here.
	 */
	entityTypes?: readonly string[];
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
