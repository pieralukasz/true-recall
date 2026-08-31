import type { SqliteStoreService } from "../../persistence/sqlite/SqliteStoreService";
import type { FsrsReplayService } from "../../services/fsrs/fsrs-replay.service";

export interface SyncMergeResult {
	merged: number;
	cardIdsChanged: string[];
}

export function replayMergedCards(
	store: SqliteStoreService,
	replayService: FsrsReplayService | undefined,
	cardIds: Iterable<string>,
): number {
	if (!replayService) return 0;
	let replayed = 0;
	for (const cardId of new Set(cardIds)) {
		const state = replayService.replayCard(
			cardId,
			store.stats.getReplayLogsForCard(cardId),
		);
		if (!state) continue;
		store.cards.applyReplayedScheduling(cardId, state);
		replayed++;
	}
	return replayed;
}

export function dedupeConcurrentCards(
	store: SqliteStoreService,
	replayService?: FsrsReplayService,
	withinTransaction = false,
): SyncMergeResult {
	const rows = store.cards.getActiveDedupRows();
	const groups = new Map<string, typeof rows>();
	for (const row of rows) {
		const key = `${row.sourceUid}|${row.templateOrd}|${row.fieldsJson}`;
		const group = groups.get(key);
		if (group) group.push(row);
		else groups.set(key, [row]);
	}

	let merged = 0;
	const cardIdsChanged = new Set<string>();
	const merge = () => {
		for (const group of groups.values()) {
			if (group.length < 2) continue;
			const sorted = [...group].sort(
				(a, b) =>
					(a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id),
			);
			const survivor = sorted[0];
			if (!survivor) continue;
			for (const loser of sorted.slice(1)) {
				store.stats.reassignCardReviews(loser.id, survivor.id);
				store.cards.softDelete(loser.id);
				cardIdsChanged.add(loser.id);
				merged++;
			}
			if (replayMergedCards(store, replayService, [survivor.id]) > 0) {
				cardIdsChanged.add(survivor.id);
			}
		}
	};
	if (withinTransaction) merge();
	else store.transaction(merge);

	return { merged, cardIdsChanged: [...cardIdsChanged] };
}
