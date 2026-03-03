import { computed, signal } from "@preact/signals";
import type { FSRSFlashcardItem } from "@shared/types";
import { State } from "ts-fsrs";

// ── Central data signal ─────────────────────────────────────
// Holds ALL enriched card data, mirrored from SQLite.
// After any mutation, refreshCards() reloads once → all computeds cascade.

export const cards = signal<Map<string, FSRSFlashcardItem>>(new Map());

// ── Refresh from SQLite ─────────────────────────────────────
// CardQueryService.getAll() returns enriched FSRSFlashcardItem[]
// (raw SQLite data + vault-resolved sourceNoteName/sourceNotePath).

interface CardQueryLike {
	getAll(): FSRSFlashcardItem[];
}

let queryService: CardQueryLike | null = null;

export function initCardStore(qs: CardQueryLike): void {
	queryService = qs;
}

export function refreshCards(qs?: CardQueryLike): void {
	const svc = qs ?? queryService;
	if (!svc) return;
	const all = svc.getAll();
	cards.value = new Map(all.map((c) => [c.id, c]));
}

// ── Derived computeds ───────────────────────────────────────

export const allCardsArray = computed(() => [...cards.value.values()]);

export interface GlobalCounts {
	newCount: number;
	learning: number;
	due: number;
	total: number;
	suspended: number;
}

export const globalCounts = computed((): GlobalCounts => {
	const now = new Date();
	let newCount = 0;
	let learning = 0;
	let due = 0;
	let total = 0;
	let suspended = 0;

	for (const card of cards.value.values()) {
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
});

export const cardsBySourceUid = computed(() => {
	const map = new Map<string, FSRSFlashcardItem[]>();
	for (const card of cards.value.values()) {
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
});

// ── Note status (replaces NoteStatusCacheService) ───────────

export interface NoteStatusInfo {
	new: number;
	learning: number;
	dueToday: number;
	total: number;
}

export const noteStatusMap = computed(() => {
	const map = new Map<string, NoteStatusInfo>();
	const now = new Date();

	for (const card of cards.value.values()) {
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
});
