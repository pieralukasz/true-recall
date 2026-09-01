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

			for (const batch of batches) {
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
		const byType = new Map<CloudSyncChange["entityType"], CloudSyncChange[]>();
		for (const change of changes) {
			const list = byType.get(change.entityType) ?? [];
			list.push(change);
			byType.set(change.entityType, list);
		}

		const pulledBefore = result.pulled;
		this.store.transaction(() => {
			const record = (change: CloudSyncChange) => {
				state.appliedVersions.set(this.entityKey(change), change.updatedAt);
			};
			for (const change of byType.get("note_type") ?? []) {
				if (
					this.store.noteTypes.upsertRowFromRemote(
						change.payload as unknown as NoteTypeRow,
						this.preferRemoteOnEqual(change, state.localVersions),
					)
				) {
					result.pulled++;
					record(change);
				}
			}
			for (const change of byType.get("note") ?? []) {
				if (
					this.store.notes.upsertRowFromRemote(
						change.payload as unknown as NoteRow,
						this.preferRemoteOnEqual(change, state.localVersions),
					)
				) {
					result.pulled++;
					record(change);
				}
			}
			for (const change of byType.get("card") ?? []) {
				if (
					this.store.cards.upsertFromRemote(
						change.payload as unknown as FSRSCardData & {
							updatedAt?: number;
							deletedAt?: number | null;
						},
						this.preferRemoteOnEqual(change, state.localVersions),
					)
				) {
					result.pulled++;
					result.cardIdsChanged.push(change.entityId);
					record(change);
				}
			}
			for (const change of byType.get("review_log") ?? []) {
				const log = change.payload as unknown as ReviewLogForSync;
				if (
					this.store.stats.upsertReviewLogFromRemote(
						log,
						this.preferRemoteOnEqual(change, state.localVersions),
					)
				) {
					result.pulled++;
					result.reviewLogsApplied++;
					record(change);
					if (
						log.deletedAt == null &&
						log.reviewKind !== "preview" &&
						state.localReviewed.has(log.cardId)
					) {
						state.replayCandidates.add(log.cardId);
					}
				}
			}
			if (result.pulled > pulledBefore) {
				// Persisted with the page so a later failure (or crash) neither
				// echoes these rows back nor skips their stats/replay work.
				state.pulledSinceProcess = true;
				this.meta.writeAppliedVersions(state.appliedVersions);
				this.meta.writePending({
					replay: [...state.replayCandidates],
					pulled: true,
				});
			}
		});
		return cursor;
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
