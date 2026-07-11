import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import { DomainEventBus } from "@true-recall/core/events/event-bus";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import {
	DataLayer,
	G,
	type GlobalCounts,
	type NoteStatusInfo,
	Q,
	wireDataLayer,
} from "@true-recall/obsidian/data";

function makeMeta(
	id: string,
	state: State,
	sourceUid = "source-1",
): CardSchedulingMeta {
	return {
		id,
		sourceUid,
		sourceNoteName: "Note",
		sourceNotePath: "Note.md",
		fsrs: {
			id,
			due: new Date().toISOString(),
			stability: 1,
			difficulty: 5,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: state === State.New ? 0 : 1,
			lapses: 0,
			state,
			lastReview: null,
			suspended: false,
			buriedUntil: null,
		},
	};
}

function registerRemovalQueries(
	dl: DataLayer,
	cards: CardSchedulingMeta[],
): void {
	dl.register<ReadonlySet<string>>(Q.ARCHIVED_UIDS, () => new Set(), [G.CARDS]);
	dl.register<Map<string, CardSchedulingMeta>>(
		Q.ALL_META,
		() => new Map(cards.map((card) => [card.id, card])),
		[G.CARDS],
	);
	dl.register<GlobalCounts>(
		Q.GLOBAL_COUNTS,
		() => ({
			newCount: 1,
			learning: 1,
			due: 0,
			total: 2,
			suspended: 0,
		}),
		[G.CARDS, G.DASHBOARD],
	);
	dl.register<Map<string, NoteStatusInfo>>(
		Q.NOTE_STATUS,
		() =>
			new Map([
				["source-1", { new: 1, learning: 1, dueToday: 0, total: 2 }],
			]),
		[G.CARDS],
	);
	dl.register<Map<string, CardSchedulingMeta[]>>(
		Q.CARDS_BY_SOURCE,
		() => new Map([["source-1", cards]]),
		[G.CARDS, G.PANEL],
	);
}

describe("wireDataLayer", () => {
	it("patches removed bulk cards without a full group invalidation", () => {
		const kept = makeMeta("kept", State.New);
		const removed = makeMeta("removed", State.Learning);
		const dl = new DataLayer();
		registerRemovalQueries(dl, [kept, removed]);
		const invalidateSpy = vi.spyOn(dl, "invalidateGroups");
		const bus = new DomainEventBus();

		wireDataLayer(dl, bus);
		bus.emit("cards:bulk", {
			cardIds: [removed.id],
			action: "removed",
		});

		expect(invalidateSpy).not.toHaveBeenCalled();
		expect(
			dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META)?.has(removed.id),
		).toBe(false);
		expect(dl.get<GlobalCounts>(Q.GLOBAL_COUNTS)).toEqual({
			newCount: 1,
			learning: 0,
			due: 0,
			total: 1,
			suspended: 0,
		});
		expect(
			dl.get<Map<string, NoteStatusInfo>>(Q.NOTE_STATUS)?.get("source-1"),
		).toEqual({
				new: 1,
				learning: 0,
				dueToday: 0,
				total: 1,
			});
		expect(
			dl.get<Map<string, CardSchedulingMeta[]>>(Q.CARDS_BY_SOURCE)?.get(
				"source-1",
			),
		).toEqual([kept]);
	});

	it("falls back to group invalidation for mixed bulk events", () => {
		const dl = new DataLayer();
		registerRemovalQueries(dl, [makeMeta("kept", State.New)]);
		const invalidateSpy = vi.spyOn(dl, "invalidateGroups");
		const bus = new DomainEventBus();

		wireDataLayer(dl, bus);
		bus.emit("cards:bulk", {
			cardIds: ["kept"],
			action: "updated",
		});

		expect(invalidateSpy).toHaveBeenCalledWith([
			G.CARDS,
			G.BROWSER,
			G.DASHBOARD,
			G.PANEL,
			G.REVIEW,
			G.STATS,
		]);
	});
});
