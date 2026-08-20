import { describe, expect, it } from "vitest";

import { moveItem, moveItemAmong } from "../../src/utils/array.utils";

describe("moveItem", () => {
	const items = ["a", "b", "c", "d"] as const;

	it.each([
		["down", 0, 2, ["b", "c", "a", "d"]],
		["up", 3, 1, ["a", "d", "b", "c"]],
		["to the end", 0, 3, ["b", "c", "d", "a"]],
		["to the front", 2, 0, ["c", "a", "b", "d"]],
	])("moves an item %s", (_label, from, to, expected) => {
		expect(moveItem(items, from, to)).toEqual(expected);
	});

	it("returns an unchanged copy when the position does not change", () => {
		const result = moveItem(items, 1, 1);
		expect(result).toEqual([...items]);
		expect(result).not.toBe(items);
	});

	it.each([
		["source below range", -1, 1],
		["source above range", 4, 1],
		["target below range", 1, -1],
		["target above range", 1, 4],
	])("ignores a move with %s", (_label, from, to) => {
		expect(moveItem(items, from, to)).toEqual([...items]);
	});

	it("does not mutate the input", () => {
		const source = [...items];
		moveItem(source, 0, 2);
		expect(source).toEqual([...items]);
	});
});

describe("moveItemAmong", () => {
	interface Preset {
		id: string;
		builtin: boolean;
	}

	const presets: Preset[] = [
		{ id: "builtin-1", builtin: true },
		{ id: "user-a", builtin: false },
		{ id: "user-b", builtin: false },
		{ id: "user-c", builtin: false },
	];
	const isMovable = (p: Preset) => !p.builtin;
	const ids = (list: Preset[]) => list.map((p) => p.id);

	it("reorders the movable subset using subset indices", () => {
		expect(ids(moveItemAmong(presets, isMovable, 0, 2))).toEqual([
			"builtin-1",
			"user-b",
			"user-c",
			"user-a",
		]);
	});

	it("keeps pinned items in their original slots", () => {
		const interleaved: Preset[] = [
			{ id: "user-a", builtin: false },
			{ id: "builtin-1", builtin: true },
			{ id: "user-b", builtin: false },
		];

		expect(ids(moveItemAmong(interleaved, isMovable, 1, 0))).toEqual([
			"user-b",
			"builtin-1",
			"user-a",
		]);
	});

	it("leaves the list untouched when the subset index is out of range", () => {
		expect(ids(moveItemAmong(presets, isMovable, 0, 3))).toEqual(ids(presets));
	});
});
