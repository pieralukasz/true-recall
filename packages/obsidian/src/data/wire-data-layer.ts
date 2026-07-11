import { batch } from "@preact/signals";
import { State } from "ts-fsrs";

import type { DomainEventBus } from "@true-recall/core/events/event-bus";
import type { DomainEventType } from "@true-recall/core/events/event-types";
import type { CardSchedulingMeta } from "@true-recall/core/types";

import { setLastMutation } from "@true-recall/obsidian/services/signals";

import type { DataLayer } from "./data-layer";
import { G, type GlobalCounts, type NoteStatusInfo, Q } from "./queries";

const EVENT_TO_GROUPS: Record<string, string[]> = {
	"card:added": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.STATS],
	"card:updated": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL],
	"card:removed": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.STATS],
	"card:reviewed": [G.CARDS, G.DASHBOARD, G.STATS, G.PANEL],
	"cards:bulk": [G.CARDS, G.BROWSER, G.DASHBOARD, G.PANEL, G.REVIEW, G.STATS],
	"hierarchy:changed": [G.CARDS, G.DASHBOARD, G.REVIEW],
	"settings:changed": [
		G.CARDS,
		G.BROWSER,
		G.DASHBOARD,
		G.REVIEW,
		G.STATS,
		G.SETTINGS,
	],
};

const CARD_EVENTS: DomainEventType[] = [
	"card:added",
	"card:updated",
	"card:removed",
	"card:reviewed",
	"cards:bulk",
];

function domainEventToLastMutation(
	event: DomainEventType,
	payload: unknown,
): Parameters<typeof setLastMutation>[0] | null {
	const p = payload as Record<string, unknown>;
	const cardId = typeof p.cardId === "string" ? p.cardId : undefined;
	switch (event) {
		case "card:added":
			if (!cardId) return null;
			return {
				type: "added",
				cardId,
				sourceNoteName:
					typeof p.sourceNoteName === "string" ? p.sourceNoteName : undefined,
			};
		case "card:updated":
			if (!cardId) return null;
			return {
				type: "updated",
				cardId,
				changes: (p.changes as Record<string, boolean>) ?? {},
			};
		case "card:removed":
			if (!cardId) return null;
			return {
				type: "removed",
				cardId,
				cardIds: Array.isArray(p.cardIds) ? p.cardIds : [],
			};
		case "card:reviewed":
			if (!cardId) return null;
			return {
				type: "reviewed",
				cardId,
				rating: typeof p.rating === "number" ? p.rating : 0,
				newState: typeof p.newState === "number" ? p.newState : 0,
			};
		case "cards:bulk":
			return {
				type: "bulk",
				cardIds: Array.isArray(p.cardIds) ? p.cardIds : [],
				action:
					typeof p.action === "string"
						? (p.action as Parameters<typeof setLastMutation>[0]["action"])
						: undefined,
			};
		default:
			return null;
	}
}

type CardBucket = "new" | "learning" | "due" | "suspended" | "inactive";

function classifyCard(meta: CardSchedulingMeta, now: Date): CardBucket {
	const fsrs = meta.fsrs;
	if (fsrs.suspended) return "suspended";
	if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now) return "inactive";

	switch (fsrs.state) {
		case State.New:
			return "new";
		case State.Learning:
		case State.Relearning:
			return "learning";
		case State.Review:
			return new Date(fsrs.due) <= now ? "due" : "inactive";
		default:
			return "inactive";
	}
}

function patchRemovedCards(dl: DataLayer, cardIds: string[]): boolean {
	const allMeta = dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META);
	if (!allMeta) return false;

	const uniqueIds = [...new Set(cardIds)];
	const removed = uniqueIds
		.map((id) => allMeta.get(id))
		.filter((meta): meta is CardSchedulingMeta => Boolean(meta));
	if (removed.length === 0) return true;

	const archived =
		dl.get<ReadonlySet<string>>(Q.ARCHIVED_UIDS) ?? new Set<string>();
	const now = new Date();

	batch(() => {
		dl.patch<Map<string, CardSchedulingMeta>>(Q.ALL_META, (map) => {
			const next = new Map(map);
			for (const id of uniqueIds) next.delete(id);
			return next;
		});

		dl.patch<GlobalCounts>(Q.GLOBAL_COUNTS, (counts) => {
			const next = { ...counts };
			for (const meta of removed) {
				if (archived.has(meta.sourceUid ?? "")) continue;
				next.total = Math.max(0, next.total - 1);

				const bucket = classifyCard(meta, now);
				if (bucket === "suspended") {
					next.suspended = Math.max(0, next.suspended - 1);
				}
				if (bucket === "new") next.newCount = Math.max(0, next.newCount - 1);
				if (bucket === "learning") {
					next.learning = Math.max(0, next.learning - 1);
				}
				if (bucket === "due") next.due = Math.max(0, next.due - 1);
			}
			return next;
		});

		dl.patch<Map<string, NoteStatusInfo>>(Q.NOTE_STATUS, (map) => {
			const next = new Map(map);
			for (const meta of removed) {
				const sourceUid = meta.sourceUid;
				if (!sourceUid) continue;

				const info = next.get(sourceUid);
				if (!info) return undefined;

				const updated = { ...info, total: Math.max(0, info.total - 1) };
				const bucket = classifyCard(meta, now);
				if (bucket === "new") updated.new = Math.max(0, updated.new - 1);
				if (bucket === "learning") {
					updated.learning = Math.max(0, updated.learning - 1);
				}
				if (bucket === "due") {
					updated.dueToday = Math.max(0, updated.dueToday - 1);
				}

				if (updated.total === 0) {
					next.delete(sourceUid);
				} else {
					next.set(sourceUid, updated);
				}
			}
			return next;
		});

		dl.patch<Map<string, CardSchedulingMeta[]>>(Q.CARDS_BY_SOURCE, (map) => {
			const removedIds = new Set(uniqueIds);
			const next = new Map(map);
			for (const meta of removed) {
				const sourceUid = meta.sourceUid;
				if (!sourceUid) continue;

				const bucket = next.get(sourceUid);
				if (!bucket) return undefined;

				const updated = bucket.filter((card) => !removedIds.has(card.id));
				if (updated.length === 0) {
					next.delete(sourceUid);
				} else {
					next.set(sourceUid, updated);
				}
			}
			return next;
		});
	});

	return true;
}

function tryHandleIncrementalEvent(
	dl: DataLayer,
	event: DomainEventType,
	payload: unknown,
	mutation: Parameters<typeof setLastMutation>[0] | null,
): boolean {
	if (event === "card:removed") {
		const p = payload as Record<string, unknown>;
		const cardId = typeof p.cardId === "string" ? p.cardId : undefined;
		const cardIds: unknown[] = Array.isArray(p.cardIds) ? p.cardIds : [];
		const ids = [cardId, ...cardIds].filter(
			(id): id is string => typeof id === "string",
		);
		return ids.length > 0 && patchRemovedCards(dl, ids);
	}

	if (event === "cards:bulk" && mutation?.action === "removed") {
		const ids = Array.isArray(mutation.cardIds) ? mutation.cardIds : [];
		return ids.length > 0 && patchRemovedCards(dl, ids);
	}

	return false;
}

/**
 * Bridge: core domain events -> DataLayer invalidation + lastMutation signal.
 */
export function wireDataLayer(dl: DataLayer, bus: DomainEventBus): () => void {
	const disposers: (() => void)[] = [];

	// Typed domain events -> DataLayer invalidation + lastMutation.
	// Set lastMutation BEFORE invalidating groups so effects that read both
	// observe a consistent mutation type when DataLayer signals fire.
	disposers.push(
		bus.onAny(
			[...CARD_EVENTS, "hierarchy:changed", "settings:changed"],
			(event, payload) => {
				const mutation = domainEventToLastMutation(event, payload);
				if (mutation) setLastMutation(mutation);
				if (tryHandleIncrementalEvent(dl, event, payload, mutation)) return;

				const groups = EVENT_TO_GROUPS[event];
				if (groups) dl.invalidateGroups(groups);
			},
		),
	);

	return () => {
		for (const d of disposers) d();
	};
}
