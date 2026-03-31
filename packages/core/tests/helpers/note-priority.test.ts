import { describe, expect, it } from "vitest";
import {
	computePriority,
	prioritySortComparator,
} from "../../src/helpers/note-priority";
import type { DashboardNoteEntry } from "@true-recall/obsidian/features/study/ui/dashboard/types";

describe("computePriority", () => {
	it("returns 'overdue' when overdueCount > 0", () => {
		expect(
			computePriority({ overdueCount: 1, due: 0, learning: 0, newCount: 0 }),
		).toBe("overdue");
	});

	it("returns 'overdue' even when other counts are also high", () => {
		expect(
			computePriority({ overdueCount: 3, due: 20, learning: 5, newCount: 10 }),
		).toBe("overdue");
	});

	it("returns 'hot' when due + learning >= 10", () => {
		expect(
			computePriority({ overdueCount: 0, due: 7, learning: 3, newCount: 0 }),
		).toBe("hot");
	});

	it("returns 'hot' at exactly 10 (boundary)", () => {
		expect(
			computePriority({ overdueCount: 0, due: 10, learning: 0, newCount: 0 }),
		).toBe("hot");
	});

	it("returns 'due' at 9 (just below hot threshold)", () => {
		expect(
			computePriority({ overdueCount: 0, due: 5, learning: 4, newCount: 0 }),
		).toBe("due");
	});

	it("returns 'due' when due + learning > 0 but < 10", () => {
		expect(
			computePriority({ overdueCount: 0, due: 1, learning: 0, newCount: 0 }),
		).toBe("due");
	});

	it("returns 'light' when only newCount > 0", () => {
		expect(
			computePriority({ overdueCount: 0, due: 0, learning: 0, newCount: 5 }),
		).toBe("light");
	});

	it("returns 'done' when all counts are zero", () => {
		expect(
			computePriority({ overdueCount: 0, due: 0, learning: 0, newCount: 0 }),
		).toBe("done");
	});
});

function makeEntry(
	overrides: Partial<DashboardNoteEntry> & { name: string },
): DashboardNoteEntry {
	return {
		path: null,
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
		...overrides,
	};
}

describe("prioritySortComparator", () => {
	it("sorts by priority order (overdue before hot before due)", () => {
		const overdue = makeEntry({ name: "Z", priority: "overdue", due: 1 });
		const hot = makeEntry({ name: "A", priority: "hot", due: 10 });
		const due = makeEntry({ name: "B", priority: "due", due: 1 });

		const sorted = [due, hot, overdue].sort(prioritySortComparator);
		expect(sorted.map((e) => e.priority)).toEqual(["overdue", "hot", "due"]);
	});

	it("sorts by higher active count when priority is equal", () => {
		const a = makeEntry({
			name: "A",
			priority: "due",
			due: 5,
			learning: 2,
			newCount: 0,
		});
		const b = makeEntry({
			name: "B",
			priority: "due",
			due: 3,
			learning: 1,
			newCount: 0,
		});

		const sorted = [b, a].sort(prioritySortComparator);
		expect(sorted.map((e) => e.name)).toEqual(["A", "B"]);
	});

	it("sorts alphabetically by name when priority and active count are equal", () => {
		const a = makeEntry({
			name: "Beta",
			priority: "due",
			due: 2,
			learning: 0,
			newCount: 0,
		});
		const b = makeEntry({
			name: "Alpha",
			priority: "due",
			due: 2,
			learning: 0,
			newCount: 0,
		});

		const sorted = [a, b].sort(prioritySortComparator);
		expect(sorted.map((e) => e.name)).toEqual(["Alpha", "Beta"]);
	});

	it("puts 'done' entries last", () => {
		const done = makeEntry({ name: "A", priority: "done" });
		const light = makeEntry({
			name: "B",
			priority: "light",
			newCount: 1,
		});

		const sorted = [done, light].sort(prioritySortComparator);
		expect(sorted.map((e) => e.priority)).toEqual(["light", "done"]);
	});
});
