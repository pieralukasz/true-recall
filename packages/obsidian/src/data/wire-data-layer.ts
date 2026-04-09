import type { DomainEventBus } from "@true-recall/core/events/event-bus";
import type { DomainEventType } from "@true-recall/core/events/event-types";

import { setLastMutation } from "@true-recall/obsidian/services/signals";

import type { DataLayer } from "./data-layer";
import { G } from "./queries";

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

/**
 * Bridge: core domain events -> DataLayer invalidation + lastMutation signal.
 */
export function wireDataLayer(dl: DataLayer, bus: DomainEventBus): () => void {
	const disposers: (() => void)[] = [];

	// Typed domain events -> DataLayer invalidation + lastMutation
	disposers.push(
		bus.onAny(
			[...CARD_EVENTS, "hierarchy:changed", "settings:changed"],
			(event, payload) => {
				const groups = EVENT_TO_GROUPS[event];
				if (groups) dl.invalidateGroups(groups);

				const mutation = domainEventToLastMutation(event, payload);
				if (mutation) setLastMutation(mutation);
			},
		),
	);

	return () => {
		for (const d of disposers) d();
	};
}
