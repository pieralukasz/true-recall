import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";

/**
 * `pushCardChild` is the push watermark of child card links. It starts at 0
 * and moves only while the server accepts them, so links made before the
 * server supported them are pushed once it does.
 */
type NumberKind = "push" | "cursor" | "pushCardChild";

/** Post-processing owed to rows already committed by an earlier, failed sync. */
export interface PendingPostProcess {
	replay: string[];
	pulled: boolean;
}

/**
 * Durable per-account sync bookkeeping stored in sync metadata. Every write
 * dirties the store and a dirty store rewrites the whole database file, so
 * each writer compares first: a sync tick that changed nothing must not cost
 * a 60 MB rewrite.
 *
 * Contents:
 * push/cursor watermarks, the versions applied from the cloud (so pulls are
 * never echoed back as pushes), post-processing owed after a mid-sync
 * failure, and the entity types the server last said it accepts.
 */
export class CloudSyncMetaStore {
	constructor(
		private readonly store: SqliteStoreService,
		private readonly accountId: string,
	) {}

	readNumber(kind: NumberKind): number {
		const value = this.store.cards.getSyncMetadata(this.key(kind));
		const parsed = Number(value ?? 0);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}

	writeNumber(kind: NumberKind, value: number): void {
		this.store.cards.setSyncMetadataIfChanged(this.key(kind), String(value));
	}

	/** Applied-from-cloud versions, pruned to entries the push watermark can still see. */
	readAppliedVersions(minTimestamp: number): Map<string, number> {
		const raw = this.store.cards.getSyncMetadata(this.key("applied"));
		const versions = new Map<string, number>();
		if (!raw) return versions;
		try {
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof value === "number" && value > minTimestamp) {
					versions.set(key, value);
				}
			}
		} catch {
			// Corrupted bookkeeping only costs one echo push; start clean.
		}
		return versions;
	}

	writeAppliedVersions(versions: Map<string, number>): void {
		this.store.cards.setSyncMetadataIfChanged(
			this.key("applied"),
			JSON.stringify(Object.fromEntries(versions)),
		);
	}

	readPending(): PendingPostProcess {
		const raw = this.store.cards.getSyncMetadata(this.key("pending"));
		if (!raw) return { replay: [], pulled: false };
		try {
			const parsed = JSON.parse(raw) as Partial<PendingPostProcess>;
			return {
				replay: Array.isArray(parsed.replay)
					? parsed.replay.filter((id): id is string => typeof id === "string")
					: [],
				pulled: parsed.pulled === true,
			};
		} catch {
			return { replay: [], pulled: false };
		}
	}

	writePending(pending: PendingPostProcess | null): void {
		this.store.cards.setSyncMetadataIfChanged(
			this.key("pending"),
			pending ? JSON.stringify(pending) : "",
		);
	}

	/** Types the server accepts, or null for a server that does not say. */
	readServerEntityTypes(): string[] | null {
		const raw = this.store.cards.getSyncMetadata(this.key("types"));
		if (!raw) return null;
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed)
				? parsed.filter((type): type is string => typeof type === "string")
				: null;
		} catch {
			return null;
		}
	}

	writeServerEntityTypes(types: readonly string[] | null): void {
		this.store.cards.setSyncMetadataIfChanged(
			this.key("types"),
			types ? JSON.stringify(types) : "",
		);
	}

	private key(kind: NumberKind | "applied" | "pending" | "types"): string {
		return `cloud:${this.accountId}:${kind}`;
	}
}
