import { computed, type ReadonlySignal, signal } from "@preact/signals";
import { DEFAULT_SETTINGS } from "@shared/constants";
import type { FSRSFlashcardItem, TrueRecallSettings } from "@shared/types";
import { State } from "ts-fsrs";

// ── Central data signal ─────────────────────────────────────
// Holds ALL enriched card data, mirrored from SQLite.
// After any mutation, refreshCards() reloads once → all computeds cascade.

const _cards = signal<Map<string, FSRSFlashcardItem>>(new Map());
export const cards: ReadonlySignal<Map<string, FSRSFlashcardItem>> = _cards;

// ── Refresh from SQLite ─────────────────────────────────────
// CardQueryService.getAll() returns enriched FSRSFlashcardItem[]
// (raw SQLite data + vault-resolved sourceNoteName/sourceNotePath).

export interface CardQueryLike {
	getAll(): FSRSFlashcardItem[];
}

let queryService: CardQueryLike | null = null;

export function initCardStore(qs: CardQueryLike): void {
	queryService = qs;
}

export function refreshCards(qs?: CardQueryLike): void {
	const svc = qs ?? queryService;
	if (!svc) return;
	try {
		const all = svc.getAll();
		_cards.value = new Map(all.map((c) => [c.id, c]));
	} catch (e) {
		console.error("[reactive-card-store] refreshCards failed:", e);
	}
}

// ── Plugin settings signal ───────────────────────────────────

const _pluginSettings = signal<TrueRecallSettings>(DEFAULT_SETTINGS);
export const pluginSettings: ReadonlySignal<TrueRecallSettings> =
	_pluginSettings;

export function refreshSettings(settings: TrueRecallSettings): void {
	_pluginSettings.value = { ...settings };
}

// ── Metadata signal (replaces metadataVersion counter) ──────

interface MetadataServiceLike {
	getArchivedSourceUids(): Set<string>;
}

let metadataService: MetadataServiceLike | null = null;

const _archivedSourceUids = signal<ReadonlySet<string>>(new Set());
export const archivedSourceUids: ReadonlySignal<ReadonlySet<string>> =
	_archivedSourceUids;

export function initMetadataStore(svc: MetadataServiceLike): void {
	metadataService = svc;
}

export function refreshMetadata(): void {
	if (!metadataService) return;
	_archivedSourceUids.value = metadataService.getArchivedSourceUids();
}

const _hierarchyVersion = signal(0);
export const hierarchyVersion: ReadonlySignal<number> = _hierarchyVersion;

export function refreshHierarchy(): void {
	_hierarchyVersion.value++;
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
	const archived = _archivedSourceUids.value;
	let newCount = 0;
	let learning = 0;
	let due = 0;
	let total = 0;
	let suspended = 0;

	for (const card of cards.value.values()) {
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
