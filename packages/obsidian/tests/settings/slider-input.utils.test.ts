import { describe, expect, it } from "vitest";

import {
	decimalsOf,
	snapToStep,
} from "@true-recall/obsidian/components/slider-input.utils";

describe("decimalsOf", () => {
	it.each([
		[1, 0],
		[5, 0],
		[0.1, 1],
		[0.05, 2],
		[0.01, 2],
	])("step %s implies %s decimals", (step, expected) => {
		expect(decimalsOf(step)).toBe(expected);
	});
});

describe("snapToStep", () => {
	it("keeps whole-number targets as typed", () => {
		expect(snapToStep(462, 1, 700, 1)).toBe(462);
	});

	it("clamps below min and above max", () => {
		expect(snapToStep(-4, 1, 100, 1)).toBe(1);
		expect(snapToStep(9000, 1, 100, 1)).toBe(100);
	});

	it("lets the target exceed max when the track rescales", () => {
		expect(snapToStep(462, 1, 150, 1, true)).toBe(462);
	});

	it("still enforces min when above-max is allowed", () => {
		expect(snapToStep(0, 1, 150, 1, true)).toBe(1);
	});

	it("rounds onto the nearest step offset from min", () => {
		expect(snapToStep(12, 0, 50, 5)).toBe(10);
		expect(snapToStep(13, 0, 50, 5)).toBe(15);
		expect(snapToStep(0.855, 0.7, 0.99, 0.01)).toBe(0.86);
		expect(snapToStep(0.74, 0.2, 0.8, 0.05)).toBe(0.75);
	});

	it("avoids float drift in the committed value", () => {
		expect(snapToStep(0.7, 0, 2, 0.1)).toBe(0.7);
		expect(snapToStep(0.03, 0, 0.09, 0.01)).toBe(0.03);
	});
});
