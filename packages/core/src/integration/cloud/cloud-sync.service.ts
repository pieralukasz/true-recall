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
import { dedupeConcurrentCards, replayMergedCards } from "./sync-merge";

const PUSH_BATCH_SIZE = 400;
const MAX_PULL_PAGES = 1000;

interface CloudSyncOptions {
	accountId: string;
	deviceId: string;
	replayService?: FsrsReplayService;
	getDayStartHour?: () => number;
}

function rowTimestamp(row: Record<string, unknown>): number {
	const value = row.updatedAt ?? row.updated_at;
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asPayload(value: object): Record<string, unknown> {
	return value as Record<string, unknown>;
}

export class CloudSyncService {
	constructor(
		private readonly store: SqliteStoreService,
		private readonly transport: CloudSyncTransport,
		private readonly options: CloudSyncOptions,
	) {}

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
		const pushWatermark = this.readMeta("push");
		let cursor = this.readMeta("cursor");
		const localChanges = this.gatherLocalChanges(pushWatermark);
		const localVersions = new Map(
			localChanges.map((change) => [this.entityKey(change), change.updatedAt]),
		);
		const localReviewed = new Set(
			this.store.stats.getReviewedCardIdsSince(pushWatermark),
		);
		const replayCandidates = new Set<string>();

		try {
			const batches = this.chunk(localChanges, PUSH_BATCH_SIZE);
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
					localVersions,
					localReviewed,
					replayCandidates,
				);
				let hasMore = response.hasMore;
				let pages = 0;
				while (hasMore) {
					if (++pages > MAX_PULL_PAGES) {
						throw new Error("Cloud sync exceeded the pull page safety limit");
					}
					const next = await this.transport.exchange({ cursor, changes: [] });
					cursor = this.applyResponse(
						next.changes,
						next.cursor,
						result,
						localVersions,
						localReviewed,
						replayCandidates,
					);
					hasMore = next.hasMore;
				}
			}

			this.store.transaction(() => {
				result.conflictsReplayed = replayMergedCards(
					this.store,
					this.options.replayService,
					replayCandidates,
				);
				const deduped = dedupeConcurrentCards(
					this.store,
					this.options.replayService,
					true,
				);
				result.duplicatesMerged = deduped.merged;
				result.cardIdsChanged.push(...deduped.cardIdsChanged);
			});

			if (result.pulled > 0 || result.conflictsReplayed > 0) {
				this.store.stats.rebuildDailyStatsFromReviewLog(
					this.options.getDayStartHour?.(),
				);
			}
			const maxLocalTimestamp = localChanges.reduce(
				(max, change) => Math.max(max, change.updatedAt),
				pushWatermark,
			);
			this.writeMeta("push", maxLocalTimestamp);
			this.writeMeta("cursor", cursor);
			result.cardIdsChanged = [...new Set(result.cardIdsChanged)];
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			result.errors.push(message);
			return result;
		}
	}

	private gatherLocalChanges(since: number): CloudSyncChange[] {
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
			.filter((change) => change.updatedAt > since)
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
		localVersions: Map<string, number>,
		localReviewed: Set<string>,
		replayCandidates: Set<string>,
	): number {
		const byType = new Map<CloudSyncChange["entityType"], CloudSyncChange[]>();
		for (const change of changes) {
			const list = byType.get(change.entityType) ?? [];
			list.push(change);
			byType.set(change.entityType, list);
		}

		this.store.transaction(() => {
			for (const change of byType.get("note_type") ?? []) {
				const preferRemoteOnEqual = this.preferRemoteOnEqual(
					change,
					localVersions,
				);
				if (
					this.store.noteTypes.upsertRowFromRemote(
						change.payload as unknown as NoteTypeRow,
						preferRemoteOnEqual,
					)
				)
					result.pulled++;
			}
			for (const change of byType.get("note") ?? []) {
				const preferRemoteOnEqual = this.preferRemoteOnEqual(
					change,
					localVersions,
				);
				if (
					this.store.notes.upsertRowFromRemote(
						change.payload as unknown as NoteRow,
						preferRemoteOnEqual,
					)
				)
					result.pulled++;
			}
			for (const change of byType.get("card") ?? []) {
				const preferRemoteOnEqual = this.preferRemoteOnEqual(
					change,
					localVersions,
				);
				if (
					this.store.cards.upsertFromRemote(
						change.payload as unknown as FSRSCardData & {
							updatedAt?: number;
							deletedAt?: number | null;
						},
						preferRemoteOnEqual,
					)
				) {
					result.pulled++;
					result.cardIdsChanged.push(change.entityId);
				}
			}
			for (const change of byType.get("review_log") ?? []) {
				const log = change.payload as unknown as ReviewLogForSync;
				if (
					this.store.stats.upsertReviewLogFromRemote(
						log,
						this.preferRemoteOnEqual(change, localVersions),
					)
				) {
					result.pulled++;
					result.reviewLogsApplied++;
					if (
						log.deletedAt == null &&
						log.reviewKind !== "preview" &&
						localReviewed.has(log.cardId)
					) {
						replayCandidates.add(log.cardId);
					}
				}
			}
		});
		return cursor;
	}

	private readMeta(kind: "push" | "cursor"): number {
		const value = this.store.cards.getSyncMetadata(this.metaKey(kind));
		const parsed = Number(value ?? 0);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}

	private writeMeta(kind: "push" | "cursor", value: number): void {
		this.store.cards.setSyncMetadata(this.metaKey(kind), String(value));
	}

	private metaKey(kind: "push" | "cursor"): string {
		return `cloud:${this.options.accountId}:${kind}`;
	}

	private entityKey(change: CloudSyncChange): string {
		return `${change.entityType}:${change.entityId}`;
	}

	private preferRemoteOnEqual(
		change: CloudSyncChange,
		localVersions: Map<string, number>,
	): boolean {
		return (
			localVersions.get(this.entityKey(change)) === change.updatedAt &&
			typeof change.sourceDeviceId === "string" &&
			change.sourceDeviceId > this.options.deviceId
		);
	}

	private chunk<T>(items: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let index = 0; index < items.length; index += size) {
			chunks.push(items.slice(index, index + size));
		}
		return chunks;
	}
}
