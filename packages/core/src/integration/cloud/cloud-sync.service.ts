import type { DeferrableEntityType } from "../../persistence/sqlite/modules/CloudSyncDeferredActions";
import type { NoteRow } from "../../persistence/sqlite/modules/NoteActions";
import type { NoteTypeRow } from "../../persistence/sqlite/modules/NoteTypeActions";
import type { ReviewLogForSync } from "../../persistence/sqlite/modules/stats/review-log-actions";
import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import type { FsrsReplayService } from "../../services/fsrs/fsrs-replay.service";
import type { FSRSCardData } from "../../types";
import type {
	CloudSyncChange,
	CloudSyncResult,
	CloudSyncTransport,
} from "./cloud-sync.types";
import { CloudSyncMetaStore } from "./cloud-sync-meta";
import { dedupeConcurrentCards, replayMergedCards } from "./sync-merge";

const PUSH_BATCH_SIZE = 400;
// The edge function rejects bodies over 5 MB; leave headroom for the envelope.
const MAX_PUSH_BATCH_BYTES = 4 * 1024 * 1024;
const MAX_PULL_PAGES = 1000;
const TYPE_ORDER: Record<CloudSyncChange["entityType"], number> = {
	note_type: 0,
	note: 1,
	card: 2,
	review_log: 3,
};

const textEncoder = new TextEncoder();

interface CloudSyncOptions {
	accountId: string;
	deviceId: string;
	replayService?: FsrsReplayService;
	getDayStartHour?: () => number;
}

/** Mutable bookkeeping shared between the sync loop and page application. */
interface SyncState {
	localVersions: Map<string, number>;
	localReviewed: Set<string>;
	replayCandidates: Set<string>;
	appliedVersions: Map<string, number>;
	/** True once any page applied rows that still owe post-processing. */
	pulledSinceProcess: boolean;
	/** Rows parked this run because their parent had not arrived yet. */
	deferredThisRun: number;
}

function rowTimestamp(row: Record<string, unknown>): number {
	const value = row.updatedAt ?? row.updated_at;
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asPayload(value: object): Record<string, unknown> {
	return value as Record<string, unknown>;
}

export class CloudSyncService {
	private readonly meta: CloudSyncMetaStore;

	constructor(
		private readonly store: SqliteStoreService,
		private readonly transport: CloudSyncTransport,
		private readonly options: CloudSyncOptions,
	) {
		this.meta = new CloudSyncMetaStore(store, options.accountId);
	}

	async sync(): Promise<CloudSyncResult> {
		const result: CloudSyncResult = {
			pulled: 0,
			pushed: 0,
			cardIdsChanged: [],
			reviewLogsApplied: 0,
			conflictsReplayed: 0,
			duplicatesMerged: 0,
			deferred: 0,
			errors: [],
		};
		const pushWatermark = this.meta.readNumber("push");
		let cursor = this.meta.readNumber("cursor");
		const pending = this.meta.readPending();
		const state: SyncState = {
			localVersions: new Map(),
			localReviewed: new Set(
				this.store.stats.getReviewedCardIdsSince(pushWatermark),
			),
			replayCandidates: new Set(pending.replay),
			appliedVersions: this.meta.readAppliedVersions(pushWatermark),
			pulledSinceProcess: pending.pulled,
			deferredThisRun: 0,
		};
		const localChanges = this.gatherLocalChanges(
			pushWatermark,
			state.appliedVersions,
		);
		state.localVersions = new Map(
			localChanges.map((change) => [this.entityKey(change), change.updatedAt]),
		);

		try {
			const batches = this.chunk(localChanges);
			if (batches.length === 0) batches.push([]);

			for (const [index, batch] of batches.entries()) {
				const response = await this.transport.exchange({
					cursor,
					changes: batch,
				});
				result.pushed += batch.length;
				cursor = this.applyResponse(
					response.changes,
					response.cursor,
					result,
					state,
				);
				let hasMore = response.hasMore;
				let pages = 0;
				while (hasMore) {
					if (++pages > MAX_PULL_PAGES) {
						throw new Error("Cloud sync exceeded the pull page safety limit");
					}
					const next = await this.transport.exchange({ cursor, changes: [] });
					cursor = this.applyResponse(next.changes, next.cursor, result, state);
					hasMore = next.hasMore;
				}
				// A first sync from a large collection is hundreds of requests. Commit
				// progress after every batch so a dropped connection on a phone resumes
				// from here instead of pushing and pulling everything again.
				this.meta.writeNumber("cursor", cursor);
				const boundary = this.pushBoundary(batches, index);
				if (boundary > pushWatermark) this.meta.writeNumber("push", boundary);
			}

			this.postProcess(result, state);

			const maxLocalTimestamp = localChanges.reduce(
				(max, change) => Math.max(max, change.updatedAt),
				pushWatermark,
			);
			this.meta.writeNumber("push", maxLocalTimestamp);
			this.meta.writeNumber("cursor", cursor);
			this.meta.writePending(null);
			result.cardIdsChanged = [...new Set(result.cardIdsChanged)];
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			result.errors.push(message);
			return result;
		}
	}

	/** Replay, dedupe, and stats rebuild for everything applied but not yet processed. */
	private postProcess(result: CloudSyncResult, state: SyncState): void {
		// Rows parked by an earlier, interrupted run may have their parents by now.
		if (this.store.cloudSyncDeferred.count() > 0) {
			this.store.transaction(() => {
				const pulledBefore = result.pulled;
				this.drainDeferred(result, state);
				if (result.pulled > pulledBefore) {
					state.pulledSinceProcess = true;
					this.meta.writeAppliedVersions(state.appliedVersions);
				}
			});
		}
		result.deferred = this.store.cloudSyncDeferred.count();
		if (state.replayCandidates.size > 0 || state.pulledSinceProcess) {
			this.store.transaction(() => {
				result.conflictsReplayed = replayMergedCards(
					this.store,
					this.options.replayService,
					state.replayCandidates,
				);
				if (state.pulledSinceProcess) {
					const deduped = dedupeConcurrentCards(
						this.store,
						this.options.replayService,
						true,
					);
					result.duplicatesMerged = deduped.merged;
					result.cardIdsChanged.push(...deduped.cardIdsChanged);
				}
			});
		}
		if (state.pulledSinceProcess || result.conflictsReplayed > 0) {
			this.store.stats.rebuildDailyStatsFromReviewLog(
				this.options.getDayStartHour?.(),
			);
		}
	}

	private gatherLocalChanges(
		since: number,
		appliedVersions: Map<string, number>,
	): CloudSyncChange[] {
		const changes: CloudSyncChange[] = [];
		const add = (
			entityType: CloudSyncChange["entityType"],
			entityId: string,
			row: object,
		) => {
			const payload = asPayload(row);
			changes.push({
				entityType,
				entityId,
				updatedAt: rowTimestamp(payload),
				payload,
			});
		};

		for (const row of this.store.noteTypes.getRawRowsModifiedSince(since))
			add("note_type", row.id, row);
		for (const row of this.store.notes.getRawRowsModifiedSince(since))
			add("note", row.id, row);
		for (const row of this.store.cards.getModifiedSince(since))
			add("card", row.id, row);
		for (const row of this.store.stats.getModifiedReviewLogSince(since))
			add("review_log", row.id, row);

		return changes
			.filter(
				// Rows written by the cloud keep their remote timestamps; pushing
				// them back would echo every pull and let a fast remote clock
				// poison the push watermark.
				(change) =>
					change.updatedAt > since &&
					appliedVersions.get(this.entityKey(change)) !== change.updatedAt,
			)
			.sort(
				(a, b) =>
					a.updatedAt - b.updatedAt ||
					a.entityType.localeCompare(b.entityType) ||
					a.entityId.localeCompare(b.entityId),
			);
	}

	private applyResponse(
		changes: CloudSyncChange[],
		cursor: number,
		result: CloudSyncResult,
		state: SyncState,
	): number {
		// Parents before children within a page; anything whose parent is still
		// missing after that is parked until the parent arrives.
		const ordered = [...changes].sort(
			(a, b) => TYPE_ORDER[a.entityType] - TYPE_ORDER[b.entityType],
		);
		const pulledBefore = result.pulled;
		const deferredBefore = state.deferredThisRun;
		this.store.transaction(() => {
			for (const change of ordered) this.applyChange(change, result, state);
			this.drainDeferred(result, state);
			if (
				result.pulled > pulledBefore ||
				state.deferredThisRun > deferredBefore
			) {
				// Persisted with the page so a later failure (or crash) neither
				// echoes these rows back nor skips their stats/replay work.
				if (result.pulled > pulledBefore) state.pulledSinceProcess = true;
				this.meta.writeAppliedVersions(state.appliedVersions);
				this.meta.writePending({
					replay: [...state.replayCandidates],
					pulled: state.pulledSinceProcess,
				});
				this.meta.writeNumber("cursor", cursor);
			}
		});
		return cursor;
	}

	/** Apply one pulled change, or park it when its parent row is missing. */
	private applyChange(
		change: CloudSyncChange,
		result: CloudSyncResult,
		state: SyncState,
	): void {
		const parent = this.parentOf(change);
		if (
			parent &&
			!this.store.cloudSyncDeferred.isParentPresent(parent.type, parent.id)
		) {
			this.store.cloudSyncDeferred.defer({
				entityType: parent.type,
				entityId: change.entityId,
				parentId: parent.id,
				updatedAt: change.updatedAt,
				sourceDeviceId: change.sourceDeviceId ?? null,
				payload: change.payload,
			});
			state.deferredThisRun++;
			return;
		}

		const prefer = this.preferRemoteOnEqual(change, state.localVersions);
		let applied = false;
		switch (change.entityType) {
			case "note_type":
				applied = this.store.noteTypes.upsertRowFromRemote(
					change.payload as unknown as NoteTypeRow,
					prefer,
				);
				break;
			case "note":
				applied = this.store.notes.upsertRowFromRemote(
					change.payload as unknown as NoteRow,
					prefer,
				);
				break;
			case "card":
				applied = this.store.cards.upsertFromRemote(
					change.payload as unknown as FSRSCardData & {
						updatedAt?: number;
						deletedAt?: number | null;
					},
					prefer,
				);
				if (applied) result.cardIdsChanged.push(change.entityId);
				break;
			case "review_log": {
				const log = change.payload as unknown as ReviewLogForSync;
				applied = this.store.stats.upsertReviewLogFromRemote(log, prefer);
				if (applied) {
					result.reviewLogsApplied++;
					if (
						log.deletedAt == null &&
						log.reviewKind !== "preview" &&
						state.localReviewed.has(log.cardId)
					) {
						state.replayCandidates.add(log.cardId);
					}
				}
				break;
			}
		}
		if (applied) {
			result.pulled++;
			state.appliedVersions.set(this.entityKey(change), change.updatedAt);
		}
	}

	/** Foreign key a pulled row depends on, if its type has one. */
	private parentOf(
		change: CloudSyncChange,
	): { type: DeferrableEntityType; id: string } | null {
		const payload = change.payload;
		switch (change.entityType) {
			case "note":
				return typeof payload.note_type_id === "string"
					? { type: "note", id: payload.note_type_id }
					: null;
			case "card":
				// A card without a note id gets a note created by the upsert itself.
				return typeof payload.noteId === "string" && payload.noteId
					? { type: "card", id: payload.noteId }
					: null;
			case "review_log":
				return typeof payload.cardId === "string"
					? { type: "review_log", id: payload.cardId }
					: null;
			default:
				return null;
		}
	}

	/** Apply parked rows whose parent exists now: notes unblock cards, cards unblock logs. */
	private drainDeferred(result: CloudSyncResult, state: SyncState): void {
		for (const type of ["note", "card", "review_log"] as const) {
			for (const row of this.store.cloudSyncDeferred.takeReady(type)) {
				this.store.cloudSyncDeferred.remove(type, row.entityId);
				this.applyChange(
					{
						entityType: type,
						entityId: row.entityId,
						updatedAt: row.updatedAt,
						payload: row.payload,
						sourceDeviceId: row.sourceDeviceId ?? undefined,
					},
					result,
					state,
				);
			}
		}
	}

	/**
	 * Highest push watermark that is safe once batches `0..index` are on the
	 * server. Batches are sorted by `updatedAt`, so everything at or below the
	 * last pushed timestamp is done unless the next batch continues that same
	 * timestamp; then the watermark stops just below it so a retry re-pushes
	 * the stragglers instead of skipping them.
	 */
	private pushBoundary(batches: CloudSyncChange[][], index: number): number {
		const batch = batches[index];
		const last = batch?.[batch.length - 1];
		if (!last) return 0;
		const next = batches[index + 1]?.[0];
		return next && next.updatedAt === last.updatedAt
			? last.updatedAt - 1
			: last.updatedAt;
	}

	private entityKey(change: CloudSyncChange): string {
		return `${change.entityType}:${change.entityId}`;
	}

	private preferRemoteOnEqual(
		change: CloudSyncChange,
		localVersions: Map<string, number>,
	): boolean {
		const pendingLocal = localVersions.get(this.entityKey(change));
		if (pendingLocal === change.updatedAt) {
			// A not-yet-pushed local edit ties: mirror the server tie-breaker.
			return (
				typeof change.sourceDeviceId === "string" &&
				change.sourceDeviceId > this.options.deviceId
			);
		}
		// No pending local edit can still win on the server, so the server's
		// stored version is the resolved winner; every device converges to it.
		return true;
	}

	private chunk(items: CloudSyncChange[]): CloudSyncChange[][] {
		const chunks: CloudSyncChange[][] = [];
		let current: CloudSyncChange[] = [];
		let currentBytes = 0;
		for (const item of items) {
			const bytes = textEncoder.encode(JSON.stringify(item)).byteLength;
			if (
				current.length > 0 &&
				(current.length >= PUSH_BATCH_SIZE ||
					currentBytes + bytes > MAX_PUSH_BATCH_BYTES)
			) {
				chunks.push(current);
				current = [];
				currentBytes = 0;
			}
			current.push(item);
			currentBytes += bytes;
		}
		if (current.length > 0) chunks.push(current);
		return chunks;
	}
}
