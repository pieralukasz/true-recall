import { describe, expect, it, vi } from "vitest";

import {
	applySelectionClick,
	retainMatchingIds,
	toggleSelectAll,
	withoutIds,
} from "@true-recall/obsidian/features/library/ui/browser/helpers/browser-selection";

const cards = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

function ids(set: ReadonlySet<string>): string[] {
	return [...set].sort();
}

describe("applySelectionClick", () => {
	describe("plain click", () => {
		it("selects only the clicked row", () => {
			const next = applySelectionClick(new Set(["a", "b"]), "c", {}, cards);
			expect(ids(next)).toEqual(["c"]);
		});

		it("clears the selection when the row was the only one selected", () => {
			const next = applySelectionClick(new Set(["c"]), "c", undefined, cards);
			expect(next.size).toBe(0);
		});

		it("narrows to the row when it was part of a larger selection", () => {
			const next = applySelectionClick(new Set(["b", "c"]), "c", {}, cards);
			expect(ids(next)).toEqual(["c"]);
		});
	});

	describe.each([
		["ctrl", { ctrlKey: true }],
		["meta", { metaKey: true }],
	])("%s click", (_label, modifiers) => {
		it("adds an unselected row", () => {
			const next = applySelectionClick(new Set(["a"]), "c", modifiers, cards);
			expect(ids(next)).toEqual(["a", "c"]);
		});

		it("removes a selected row", () => {
			const next = applySelectionClick(
				new Set(["a", "c"]),
				"c",
				modifiers,
				cards,
			);
			expect(ids(next)).toEqual(["a"]);
		});
	});

	describe("shift click", () => {
		it("adds the range from the last selected row, in either direction", () => {
			expect(
				ids(
					applySelectionClick(new Set(["b"]), "d", { shiftKey: true }, cards),
				),
			).toEqual(["b", "c", "d"]);
			expect(
				ids(
					applySelectionClick(new Set(["d"]), "b", { shiftKey: true }, cards),
				),
			).toEqual(["b", "c", "d"]);
		});

		it("anchors on the most recently added id and keeps earlier picks", () => {
			const next = applySelectionClick(
				new Set(["e", "b"]),
				"c",
				{ shiftKey: true },
				cards,
			);
			expect(ids(next)).toEqual(["b", "c", "e"]);
		});

		it("does nothing without an anchor", () => {
			const next = applySelectionClick(
				new Set(),
				"c",
				{ shiftKey: true },
				cards,
			);
			expect(next.size).toBe(0);
		});

		it("does nothing when the anchor is not loaded", () => {
			const next = applySelectionClick(
				new Set(["zzz"]),
				"c",
				{ shiftKey: true },
				cards,
			);
			expect(ids(next)).toEqual(["zzz"]);
		});
	});

	it("never mutates the input set", () => {
		const selected = new Set(["a"]);
		applySelectionClick(selected, "b", { ctrlKey: true }, cards);
		applySelectionClick(selected, "d", { shiftKey: true }, cards);
		expect(ids(selected)).toEqual(["a"]);
	});
});

describe("toggleSelectAll", () => {
	it("selects every matching id, not only the loaded page", () => {
		const all = Array.from({ length: 450 }, (_, i) => `card-${i}`);
		const next = toggleSelectAll(new Set(["card-0"]), all.length, () => all);
		expect(next.size).toBe(450);
	});

	it("clears when everything is selected, without querying", () => {
		const getIds = vi.fn(() => ["a", "b"]);
		const next = toggleSelectAll(new Set(["a", "b"]), 2, getIds);
		expect(next.size).toBe(0);
		expect(getIds).not.toHaveBeenCalled();
	});
});

describe("withoutIds", () => {
	it("drops the given ids", () => {
		expect(ids(withoutIds(new Set(["a", "b", "c"]), ["b", "x"]))).toEqual([
			"a",
			"c",
		]);
	});

	it("returns the same instance when nothing was removed", () => {
		const selected = new Set(["a"]);
		expect(withoutIds(selected, ["x"])).toBe(selected);
	});
});

describe("retainMatchingIds", () => {
	it("keeps only ids present in the matching set", () => {
		const next = retainMatchingIds(
			new Set(["a", "b", "c"]),
			new Set(["b", "c", "d"]),
		);
		expect(ids(next)).toEqual(["b", "c"]);
	});

	it("returns the same instance when every id still matches", () => {
		const selected = new Set(["a", "b"]);
		expect(retainMatchingIds(selected, new Set(["a", "b", "c"]))).toBe(
			selected,
		);
	});
});
