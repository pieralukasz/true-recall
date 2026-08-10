/**
 * Priority and ordering under R-Mode.
 *
 * With no due dates there is no lateness, so the row colour and the sort order
 * have to come from the retrievability bands instead. A note can be nowhere
 * near its due date and still be the most urgent thing in the vault.
 */

import { describe, expect, it } from "vitest";

import {
	computePriority,
	describeRetrievability,
	prioritySortComparator,
} from "../../src/helpers/note-priority";
import type {
	DashboardNoteEntry,
	NoteRetrievability,
} from "../../src/types/dashboard.types";

function spread(over: Partial<NoteRetrievability> = {}): NoteRetrievability {
	return {
		urgent: 0,
		losing: 0,
		known: 0,
		fresh: 0,
		pool: 0,
		total: 0,
		sumR: 0,
		...over,
	};
}

function note(over: Partial<DashboardNoteEntry> = {}): DashboardNoteEntry {
	return {
		name: "Note",
		path: "Note.md",
		due: 0,
		newCount: 0,
		learning: 0,
		total: 0,
		lastReview: null,
		overdueDays: 0,
		overdueCount: 0,
		estimatedMinutes: 0,
		priority: "done",
		projects: [],
		...over,
	};
}

describe("computePriority — due mode unchanged", () => {
	it.each([
		["overdue", { overdueCount: 1, due: 1, learning: 0, newCount: 0 }],
		["hot", { overdueCount: 0, due: 10, learning: 0, newCount: 0 }],
		["due", { overdueCount: 0, due: 1, learning: 0, newCount: 0 }],
		["light", { overdueCount: 0, due: 0, learning: 0, newCount: 3 }],
		["done", { overdueCount: 0, due: 0, learning: 0, newCount: 0 }],
	])("still returns %s without a spread", (expected, input) => {
		expect(computePriority(input)).toBe(expected);
	});
});

describe("computePriority — R-Mode", () => {
	const base = { overdueCount: 0, due: 0, learning: 0, newCount: 0 };

	it("flags any card below the urgent threshold", () => {
		expect(
			computePriority({ ...base, retrievability: spread({ urgent: 1 }) }),
		).toBe("overdue");
	});

	it("ignores lateness entirely once a spread is present", () => {
		// 99 cards past their due date, but none of them decayed.
		const priority = computePriority({
			overdueCount: 99,
			due: 99,
			learning: 0,
			newCount: 0,
			retrievability: spread({ known: 99, pool: 99, total: 99 }),
		});

		expect(priority).toBe("light");
	});

	it("treats a large slipping band as hot", () => {
		expect(
			computePriority({ ...base, retrievability: spread({ losing: 10 }) }),
		).toBe("hot");
	});

	it("counts learning cards toward the hot threshold", () => {
		expect(
			computePriority({
				...base,
				learning: 4,
				retrievability: spread({ losing: 6 }),
			}),
		).toBe("hot");
	});

	it("reports done only when nothing is left to do", () => {
		expect(
			computePriority({ ...base, retrievability: spread({ fresh: 40 }) }),
		).toBe("done");
	});

	it("ranks urgent above a big slipping band", () => {
		const urgent = computePriority({
			...base,
			retrievability: spread({ urgent: 1, losing: 1 }),
		});
		const slipping = computePriority({
			...base,
			retrievability: spread({ losing: 500 }),
		});

		expect(urgent).toBe("overdue");
		expect(slipping).toBe("hot");
	});
});

describe("the priority dot as the presence signal", () => {
	// The dot at the start of the row is the only presence marker: a second one
	// next to the counts duplicated it and the two could disagree.
	const base = { overdueCount: 0, due: 0, learning: 0, newCount: 0 };

	it("goes grey when every card is fresh", () => {
		expect(
			computePriority({
				...base,
				retrievability: spread({ fresh: 900, total: 900 }),
			}),
		).toBe("done");
	});

	it("goes grey on a note with no cards at all", () => {
		expect(computePriority({ ...base, retrievability: spread() })).toBe("done");
	});

	it("lights up when cards are waiting but nothing is slipping", () => {
		expect(
			computePriority({
				...base,
				retrievability: spread({ known: 5, fresh: 100 }),
			}),
		).not.toBe("done");
	});

	it("lights up for new cards even with no review cards", () => {
		expect(
			computePriority({ ...base, newCount: 3, retrievability: spread() }),
		).not.toBe("done");
	});
});

describe("describeRetrievability — the dot's tooltip", () => {
	it("stays absent when there is nothing to explain", () => {
		expect(describeRetrievability(undefined)).toBeNull();
		expect(describeRetrievability(spread())).toBeNull();
	});

	it("reports every band, the pool and the mean", () => {
		const text = describeRetrievability(
			spread({
				urgent: 2,
				losing: 8,
				known: 30,
				fresh: 60,
				pool: 40,
				total: 100,
				sumR: 91,
			}),
		);

		expect(text).toBe(
			[
				"2 at risk · 8 slipping",
				"30 known · 60 fresh",
				"40 worth reviewing now",
				"Mean retrievability 91%",
			].join("\n"),
		);
	});

	it("never divides by zero on a spread with no review cards", () => {
		expect(describeRetrievability(spread({ fresh: 0, total: 0 }))).toBeNull();
	});
});

describe("prioritySortComparator", () => {
	it("orders by the pool rather than the due count in R-Mode", () => {
		const smallPoolManyDue = note({
			name: "A",
			priority: "due",
			due: 500,
			retrievability: spread({ losing: 2, pool: 2, total: 2 }),
		});
		const bigPoolNoDue = note({
			name: "B",
			priority: "due",
			due: 0,
			retrievability: spread({ losing: 80, pool: 80, total: 80 }),
		});

		expect(
			[smallPoolManyDue, bigPoolNoDue].sort(prioritySortComparator)[0]?.name,
		).toBe("B");
	});

	it("still orders by due count when no spread is present", () => {
		const many = note({ name: "A", priority: "due", due: 50 });
		const few = note({ name: "B", priority: "due", due: 5 });

		expect([few, many].sort(prioritySortComparator)[0]?.name).toBe("A");
	});

	it("keeps priority ahead of volume", () => {
		const urgentButSmall = note({
			name: "A",
			priority: "overdue",
			retrievability: spread({ urgent: 1, pool: 1, total: 1 }),
		});
		const calmButHuge = note({
			name: "B",
			priority: "light",
			retrievability: spread({ known: 900, pool: 900, total: 900 }),
		});

		expect(
			[calmButHuge, urgentButSmall].sort(prioritySortComparator)[0]?.name,
		).toBe("A");
	});
});
