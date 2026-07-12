import { State } from "ts-fsrs";

import type { CardQueryService } from "@true-recall/core/flashcard/data/card-query.service";
import type { HierarchyService } from "@true-recall/core/services/notes/hierarchy.service";
import type {
	CardSchedulingMeta,
	TrueRecallSettings,
} from "@true-recall/core/types";

import type { DataLayer } from "./data-layer";

// ── Groups ──────────────────────────────────────────────────

export const G = {
	CARDS: "cards",
	BROWSER: "browser",
	DASHBOARD: "dashboard",
	REVIEW: "review",
	STATS: "stats",
	PANEL: "panel",
	SETTINGS: "settings",
} as const;

// ── Keys ────────────────────────────────────────────────────

export const Q = {
	ALL_META: "allMeta",
	GLOBAL_COUNTS: "globalCounts",
	CARDS_BY_SOURCE: "cardsBySource",
	NOTE_STATUS: "noteStatus",
	ARCHIVED_UIDS: "archivedUids",
	SETTINGS: "settings",
} as const;

// ── Mutation → groups mapping ───────────────────────────────

export const MUTATION_GROUPS = {
	"card:created": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.STATS],
	"card:updated": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL],
	"card:deleted": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.STATS],
	"card:suspended": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.REVIEW],
	"card:unsuspended": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.REVIEW],
	"card:buried": [G.CARDS, G.BROWSER, G.DASHBOARD, G.REVIEW],
	"card:reviewed": [G.CARDS, G.DASHBOARD, G.STATS, G.PANEL],
	"card:reset": [G.CARDS, G.BROWSER, G.DASHBOARD, G.REVIEW, G.STATS],
	"cards:bulk": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.REVIEW, G.STATS],
	"cards:imported": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.STATS],
	"note:changed": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL],
	"hierarchy:changed": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.REVIEW],
	"settings:changed": [
		G.CARDS,
		G.BROWSER,
		G.DASHBOARD,
		G.REVIEW,
		G.STATS,
		G.SETTINGS,
	],
} as const;

export type MutationType = keyof typeof MUTATION_GROUPS;

// ── Types ───────────────────────────────────────────────────

export interface GlobalCounts {
	newCount: number;
	learning: number;
	due: number;
	total: number;
	suspended: number;
}

export interface NoteStatusInfo {
	new: number;
	learning: number;
	dueToday: number;
	total: number;
}

// ── Registration ────────────────────────────────────────────

interface RegisterQueryDeps {
	cardQuery: CardQueryService;
	hierarchy: HierarchyService;
	getSettings: () => TrueRecallSettings;
}

export function registerQueries(dl: DataLayer, deps: RegisterQueryDeps): void {
	const { cardQuery, hierarchy } = deps;

	dl.register<ReadonlySet<string>>(
		Q.ARCHIVED_UIDS,
		() => hierarchy.getArchivedSourceUids(),
		[G.CARDS],
	);

	dl.register<Map<string, CardSchedulingMeta>>(
		Q.ALL_META,
		() => new Map(cardQuery.getAllMeta().map((m) => [m.id, m])),
		[G.CARDS],
	);

	dl.register<GlobalCounts>(Q.GLOBAL_COUNTS, () => {
		const metas = dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META);
		if (!metas)
			return { newCount: 0, learning: 0, due: 0, total: 0, suspended: 0 };

		const archived = dl.get<ReadonlySet<string>>(Q.ARCHIVED_UIDS) ?? new Set();
		const now = new Date();
		let newCount = 0;
		let learning = 0;
		let due = 0;
		let total = 0;
		let suspended = 0;

		for (const card of metas.values()) {
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
	}, [G.CARDS, G.DASHBOARD]);

	dl.register<Map<string, CardSchedulingMeta[]>>(Q.CARDS_BY_SOURCE, () => {
		const metas = dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META);
		if (!metas) return new Map();

		const map = new Map<string, CardSchedulingMeta[]>();
		for (const card of metas.values()) {
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
	}, [G.CARDS, G.PANEL]);

	dl.register<Map<string, NoteStatusInfo>>(Q.NOTE_STATUS, () => {
		const metas = dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META);
		if (!metas) return new Map();

		const map = new Map<string, NoteStatusInfo>();
		const now = new Date();

		for (const card of metas.values()) {
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
	}, [G.CARDS]);

	dl.register<TrueRecallSettings>(Q.SETTINGS, () => deps.getSettings(), [
		G.SETTINGS,
	]);
}
