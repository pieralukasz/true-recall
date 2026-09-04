import type {
	CloudSyncChange,
	CloudSyncExchangeRequest,
	CloudSyncExchangeResponse,
	CloudSyncTransport,
} from "../../../../src/integration/cloud/cloud-sync.types";

interface StoredChange extends CloudSyncChange {
	serverRevision: number;
	sourceDeviceId: string;
}

// Mirrors the limits the production edge function enforces.
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const MAX_CHANGES_PER_REQUEST = 400;

const textEncoder = new TextEncoder();

/**
 * In-memory stand-in for the production sync backend, implementing the same
 * contract as the `cloud_sync_exchange` Postgres function behind the edge
 * function: last-write-wins by client timestamp with a device-id tie-break,
 * monotonically increasing server revisions, revision-cursor pagination, and
 * the edge function's request validation. Exchanges are serialized by the
 * single-threaded runtime, matching the per-user advisory lock in production.
 */
export class InMemoryCloudServer {
	private readonly entities = new Map<string, StoredChange>();
	private revision = 0;
	private callsSincePlan = 0;
	private failAtCall: number | null = null;

	constructor(private readonly pageLimit = 500) {}

	get revisionCount(): number {
		return this.revision;
	}

	/** Throws "network down" on the n-th exchange counted from this call. */
	planFailure(atCall: number): void {
		this.callsSincePlan = 0;
		this.failAtCall = atCall;
	}

	entity(
		entityType: CloudSyncChange["entityType"],
		entityId: string,
	): StoredChange | undefined {
		return this.entities.get(`${entityType}:${entityId}`);
	}

	transportFor(deviceId: string): CloudSyncTransport {
		return {
			exchange: async (request) => this.exchange(deviceId, request),
		};
	}

	private exchange(
		deviceId: string,
		request: CloudSyncExchangeRequest,
	): CloudSyncExchangeResponse {
		if (this.failAtCall !== null && ++this.callsSincePlan === this.failAtCall) {
			this.failAtCall = null;
			throw new Error("network down");
		}
		if (
			textEncoder.encode(JSON.stringify(request)).byteLength > MAX_REQUEST_BYTES
		) {
			throw new Error("Sync request is too large");
		}
		if (request.changes.length > MAX_CHANGES_PER_REQUEST) {
			throw new Error("invalid changes batch");
		}

		for (const change of request.changes) {
			const key = `${change.entityType}:${change.entityId}`;
			const stored = this.entities.get(key);
			const wins =
				!stored ||
				change.updatedAt > stored.updatedAt ||
				(change.updatedAt === stored.updatedAt &&
					deviceId > stored.sourceDeviceId);
			if (!wins) continue;
			this.revision += 1;
			this.entities.set(key, {
				...change,
				sourceDeviceId: deviceId,
				serverRevision: this.revision,
			});
		}

		const cursor = Math.max(request.cursor, 0);
		const page = [...this.entities.values()]
			.filter((entity) => entity.serverRevision > cursor)
			.sort((a, b) => a.serverRevision - b.serverRevision)
			.slice(0, this.pageLimit);
		const nextCursor = page.at(-1)?.serverRevision ?? cursor;
		return {
			changes: page.map(({ serverRevision: _revision, ...change }) => change),
			cursor: nextCursor,
			hasMore: [...this.entities.values()].some(
				(entity) => entity.serverRevision > nextCursor,
			),
		};
	}
}
