import { effect } from "@preact/signals";
import { describe, expect, it } from "vitest";

import { DomainEventBus } from "@true-recall/core/events/event-bus";
import type { CardSchedulingMeta } from "@true-recall/core/types";

import {
	DataLayer,
	Q,
	registerQueries,
	wireDataLayer,
} from "@true-recall/obsidian/data";

function setup() {
	const dl = new DataLayer();
	registerQueries(dl, {
		cardQuery: { getAllMeta: () => [] } as never,
		hierarchy: { getArchivedSourceUids: () => new Set<string>() } as never,
		getSettings: () => ({}) as never,
	});
	const bus = new DomainEventBus();
	wireDataLayer(dl, bus);
	return { dl, bus };
}

describe("browser revision query", () => {
	it("changes on a content-only edit while the scheduling meta stays cached", () => {
		const { dl, bus } = setup();
		const metaBefore = dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META);
		const revisionBefore = dl.get<number>(Q.BROWSER_REVISION);

		bus.emit("card:updated", {
			cardId: "card-1",
			changes: { question: true, answer: true },
		});

		expect(dl.get(Q.BROWSER_REVISION)).not.toBe(revisionBefore);
		expect(dl.get(Q.ALL_META)).toBe(metaBefore);
	});

	it("changes on scheduling-affecting updates as well", () => {
		const { dl, bus } = setup();
		const revisionBefore = dl.get<number>(Q.BROWSER_REVISION);

		bus.emit("card:updated", { cardId: "card-1", changes: { fsrs: true } });

		expect(dl.get(Q.BROWSER_REVISION)).not.toBe(revisionBefore);
	});

	it("publishes all reloaded queries of one invalidation together", () => {
		const { dl, bus } = setup();
		const meta = dl.signal<Map<string, CardSchedulingMeta>>(Q.ALL_META);
		const revision = dl.signal<number>(Q.BROWSER_REVISION);
		const runs: number[] = [];
		const dispose = effect(() => {
			meta?.value;
			runs.push(revision?.value ?? -1);
		});
		runs.length = 0;

		bus.emit("card:updated", { cardId: "card-1", changes: { fsrs: true } });
		dispose();

		expect(runs).toHaveLength(1);
	});
});
