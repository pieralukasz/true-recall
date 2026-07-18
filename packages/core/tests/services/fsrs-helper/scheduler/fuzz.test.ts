/**
 * Fuzz math tests — cases mirror Anki's rslib fuzz.rs test table so our
 * bounds behave identically.
 */
import { describe, expect, it } from "vitest";

import {
	constrainedFuzzBounds,
	fuzzDelta,
	hashString,
	mulberry32,
	selectWeightedDay,
} from "../../../../src/metrics/fsrs-tools/scheduler/fuzz";

describe("fuzzDelta", () => {
	it("applies no fuzz below 2.5 days", () => {
		expect(fuzzDelta(1)).toBe(0);
		expect(fuzzDelta(2.49)).toBe(0);
	});

	it("grows piecewise with the interval", () => {
		expect(fuzzDelta(2.5)).toBeCloseTo(1.0, 5);
		expect(fuzzDelta(7)).toBeCloseTo(1.675, 5);
		expect(fuzzDelta(17)).toBeCloseTo(2.675, 5);
		expect(fuzzDelta(37)).toBeCloseTo(3.825, 5);
	});
});

describe("constrainedFuzzBounds", () => {
	it.each([
		["interval 2.5", 2.5, 1, 1000, 2, 4],
		["interval 7", 7, 1, 1000, 5, 9],
		["interval 17", 17, 3, 1000, 14, 20],
		["interval 37", 37, 3, 1000, 33, 41],
		["no fuzz under 2.5", 2.49, 1, 1000, 2, 2],
		["clamped to raised minimum", 100, 101, 1000, 101, 108],
		["clamped to lowered maximum", 100, 1, 99, 92, 99],
		["clamped on both sides", 100, 97, 103, 97, 103],
		["widened by one above minimum", 2.0, 3, 1000, 3, 4],
		["not widened when maximum blocks it", 2.0, 3, 3, 3, 3],
	])("%s", (_name, interval, min, max, lower, upper) => {
		expect(constrainedFuzzBounds(interval, min, max)).toEqual([lower, upper]);
	});
});

describe("deterministic selection", () => {
	it("hashString is stable for the same input", () => {
		expect(hashString("card-1:2026-02-05")).toBe(
			hashString("card-1:2026-02-05"),
		);
		expect(hashString("card-1")).not.toBe(hashString("card-2"));
	});

	it("mulberry32 yields the same sequence for the same seed", () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});

	it("selectWeightedDay picks proportionally to weights", () => {
		const random = mulberry32(hashString("seed"));
		const picks = new Map<number, number>();
		for (let i = 0; i < 1000; i++) {
			const day = selectWeightedDay(
				[
					{ day: 1, weight: 1 },
					{ day: 2, weight: 0.000001 },
				],
				random,
			);
			if (day !== null) picks.set(day, (picks.get(day) ?? 0) + 1);
		}
		expect(picks.get(1) ?? 0).toBeGreaterThan(990);
	});

	it("selectWeightedDay returns null for empty or zero-weight input", () => {
		const random = mulberry32(1);
		expect(selectWeightedDay([], random)).toBeNull();
		expect(selectWeightedDay([{ day: 1, weight: 0 }], random)).toBeNull();
	});
});
