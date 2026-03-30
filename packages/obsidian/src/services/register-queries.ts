/**
 * Register all standard queries into the QueryRuntime.
 *
 * Called once during plugin initialization. Each query has:
 *  - a key (from QK)
 *  - a loader (reads from SQL/services)
 *  - one or more groups (for invalidation)
 *
 * Views can then read data via useQuerySignal(QK.XXX).
 */

import type { FSRSFlashcardItem } from "@true-recall/core/types";
import { State } from "ts-fsrs";
import type { QueryRuntime } from "./query-runtime";
import { QG } from "./invalidation-map";
import { QK } from "./query-keys";

export interface NoteStatusInfo {
	new: number;
	learning: number;
	dueToday: number;
	total: number;
}

export interface GlobalCounts {
	newCount: number;
	learning: number;
	due: number;
	total: number;
	suspended: number;
}

export interface RegisterQueriesDeps {
	getAllCards: () => FSRSFlashcardItem[];
	getArchivedSourceUids: () => ReadonlySet<string>;
}

export function registerCoreQueries(
	runtime: QueryRuntime,
	deps: RegisterQueriesDeps,
): void {
	const { getAllCards, getArchivedSourceUids } = deps;

	// ── allCards ─────────────────────────────────────────
	// The master card cache. Other queries derive from this.
	runtime.register<Map<string, FSRSFlashcardItem>>({
		key: QK.ALL_CARDS,
		loader: () => {
			const all = getAllCards();
			return new Map(all.map((c) => [c.id, c]));
		},
		groups: [QG.CARDS],
	});

	// ── globalCounts ────────────────────────────────────
	runtime.register<GlobalCounts>({
		key: QK.GLOBAL_COUNTS,
		loader: () => {
			const cards = runtime.get<Map<string, FSRSFlashcardItem>>(QK.ALL_CARDS);
			if (!cards) return { newCount: 0, learning: 0, due: 0, total: 0, suspended: 0 };

			const archived = getArchivedSourceUids();
			const now = new Date();
			let newCount = 0;
			let learning = 0;
			let due = 0;
			let total = 0;
			let suspended = 0;

			for (const card of cards.values()) {
				if (archived.has(card.sourceUid ?? "")) continue;
				total++;
				const fsrs = card.fsrs;
				if (fsrs.suspended) {
					suspended++;
					continue;
				}
				if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now) continue;
				switch (fsrs.state) {
					case State.New:
						newCount++;
						break;
					case State.Learning:
					case State.Relearning:
						learning++;
						break;
					case State.Review:
						if (new Date(fsrs.due) <= now) due++;
						break;
				}
			}

			return { newCount, learning, due, total, suspended };
		},
		groups: [QG.CARDS, QG.DASHBOARD],
	});

	// ── cardsBySourceUid ────────────────────────────────
	runtime.register<Map<string, FSRSFlashcardItem[]>>({
		key: QK.CARDS_BY_SOURCE_UID,
		loader: () => {
			const cards = runtime.get<Map<string, FSRSFlashcardItem>>(QK.ALL_CARDS);
			if (!cards) return new Map();

			const map = new Map<string, FSRSFlashcardItem[]>();
			for (const card of cards.values()) {
				const uid = card.sourceUid;
				if (!uid) continue;
				let arr = map.get(uid);
				if (!arr) {
					arr = [];
					map.set(uid, arr);
				}
				arr.push(card);
			}
			return map;
		},
		groups: [QG.CARDS, QG.PANEL],
	});

	// ── noteStatus ──────────────────────────────────────
	runtime.register<Map<string, NoteStatusInfo>>({
		key: QK.NOTE_STATUS,
		loader: () => {
			const cards = runtime.get<Map<string, FSRSFlashcardItem>>(QK.ALL_CARDS);
			if (!cards) return new Map();

			const map = new Map<string, NoteStatusInfo>();
			const now = new Date();

			for (const card of cards.values()) {
				const uid = card.sourceUid;
				if (!uid) continue;

				let info = map.get(uid);
				if (!info) {
					info = { new: 0, learning: 0, dueToday: 0, total: 0 };
					map.set(uid, info);
				}
				info.total++;

				const fsrs = card.fsrs;
				if (fsrs.suspended) continue;
				if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now) continue;

				switch (fsrs.state) {
					case State.New:
						info.new++;
						break;
					case State.Learning:
					case State.Relearning:
						info.learning++;
						break;
					case State.Review:
						if (new Date(fsrs.due) <= now) info.dueToday++;
						break;
				}
			}
			return map;
		},
		groups: [QG.CARDS],
	});
}

/**
 * Patch a single card in the allCards cache after review grade.
 * This avoids refetching 30k cards.
 *
 * Also marks derived queries (globalCounts, cardsBySourceUid, noteStatus)
 * as stale — they will recompute on next access (lazy invalidation).
 */
export function patchReviewedCard(
	runtime: QueryRuntime,
	cardId: string,
	updatedCard: FSRSFlashcardItem,
): void {
	// Patch allCards map
	runtime.patch<Map<string, FSRSFlashcardItem>>(
		QK.ALL_CARDS,
		(cards) => {
			const newMap = new Map(cards);
			newMap.set(cardId, updatedCard);
			return newMap;
		},
	);

	// Mark derived queries stale (lazy recompute on next read)
	runtime.invalidate(QK.GLOBAL_COUNTS);
	runtime.invalidate(QK.CARDS_BY_SOURCE_UID);
	runtime.invalidate(QK.NOTE_STATUS);
}
