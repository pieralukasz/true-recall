import { describe, expect, it } from "vitest";

import {
	computeDragSelection,
	getDragSelectMode,
} from "@true-recall/obsidian/features/library/ui/panel/utils/drag-select.utils";

const rows = [["a"], ["b"], ["io1", "io2"], ["c"], ["d"]];

describe("getDragSelectMode", () => {
	it("adds when the start row is not selected", () => {
		expect(getDragSelectMode(["a"], new Set())).toBe("add");
	});

	it("removes when the start row is selected", () => {
		expect(getDragSelectMode(["a"], new Set(["a"]))).toBe("remove");
	});

	it("adds when an image occlusion group is only partly selected", () => {
		expect(getDragSelectMode(["io1", "io2"], new Set(["io1"]))).toBe("add");
	});
});

describe("computeDragSelection", () => {
	it("selects every row between start and pointer, downwards", () => {
		expect(
			computeDragSelection({
				rows,
				base: new Set(),
				anchorIndex: 0,
				overIndex: 3,
				mode: "add",
			}).sort(),
		).toEqual(["a", "b", "c", "io1", "io2"]);
	});

	it("selects upwards and keeps earlier selection outside the range", () => {
		expect(
			computeDragSelection({
				rows,
				base: new Set(["d"]),
				anchorIndex: 3,
				overIndex: 1,
				mode: "add",
			}).sort(),
		).toEqual(["b", "c", "d", "io1", "io2"]);
	});

	it("shrinking the drag restores rows outside the new range", () => {
		const base = new Set<string>();
		computeDragSelection({
			rows,
			base,
			anchorIndex: 0,
			overIndex: 4,
			mode: "add",
		});
		expect(
			computeDragSelection({
				rows,
				base,
				anchorIndex: 0,
				overIndex: 1,
				mode: "add",
			}).sort(),
		).toEqual(["a", "b"]);
	});

	it("unselects the range when the drag started on a selected row", () => {
		expect(
			computeDragSelection({
				rows,
				base: new Set(["a", "b", "c", "d"]),
				anchorIndex: 3,
				overIndex: 4,
				mode: "remove",
			}).sort(),
		).toEqual(["a", "b"]);
	});

	it("ignores indexes outside the list", () => {
		expect(
			computeDragSelection({
				rows,
				base: new Set(),
				anchorIndex: 3,
				overIndex: 99,
				mode: "add",
			}).sort(),
		).toEqual(["c", "d"]);
	});
});
