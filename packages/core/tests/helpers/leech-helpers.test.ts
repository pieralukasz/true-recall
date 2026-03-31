import { describe, it, expect } from "vitest";
import { shouldTriggerLeech } from "../../src/helpers/leech-helpers";

describe("shouldTriggerLeech", () => {
	describe("disabled / below threshold", () => {
		it("returns false when threshold is 0 (disabled)", () => {
			expect(shouldTriggerLeech(999, 0)).toBe(false);
		});

		it("returns false when threshold is negative", () => {
			expect(shouldTriggerLeech(10, -1)).toBe(false);
		});

		it("returns false when lapses < threshold", () => {
			expect(shouldTriggerLeech(7, 8)).toBe(false);
		});

		it("returns false when lapses is 0", () => {
			expect(shouldTriggerLeech(0, 8)).toBe(false);
		});
	});

	describe("threshold=8 (default, halfThreshold=4)", () => {
		const T = 8;

		it("fires exactly at threshold", () => {
			expect(shouldTriggerLeech(8, T)).toBe(true);
		});

		it("does not fire at 9 (between firing points)", () => {
			expect(shouldTriggerLeech(9, T)).toBe(false);
		});

		it("does not fire at 10", () => {
			expect(shouldTriggerLeech(10, T)).toBe(false);
		});

		it("does not fire at 11", () => {
			expect(shouldTriggerLeech(11, T)).toBe(false);
		});

		it("fires at threshold + halfThreshold = 12", () => {
			expect(shouldTriggerLeech(12, T)).toBe(true);
		});

		it("fires at threshold + 2*halfThreshold = 16", () => {
			expect(shouldTriggerLeech(16, T)).toBe(true);
		});

		it("fires at threshold + 3*halfThreshold = 20", () => {
			expect(shouldTriggerLeech(20, T)).toBe(true);
		});

		it("does not fire at 14 (midpoint between 12 and 16)", () => {
			expect(shouldTriggerLeech(14, T)).toBe(false);
		});
	});

	describe("odd threshold=7 (halfThreshold=ceil(3.5)=4)", () => {
		const T = 7;

		it("fires at 7", () => {
			expect(shouldTriggerLeech(7, T)).toBe(true);
		});

		it("fires at 11 (7+4)", () => {
			expect(shouldTriggerLeech(11, T)).toBe(true);
		});

		it("fires at 15 (7+8)", () => {
			expect(shouldTriggerLeech(15, T)).toBe(true);
		});

		it("does not fire at 9", () => {
			expect(shouldTriggerLeech(9, T)).toBe(false);
		});
	});

	describe("threshold=1 (halfThreshold=max(1,1)=1 — fires every lapse)", () => {
		const T = 1;

		it("fires at 1", () => {
			expect(shouldTriggerLeech(1, T)).toBe(true);
		});

		it("fires at 2", () => {
			expect(shouldTriggerLeech(2, T)).toBe(true);
		});

		it("fires at 5", () => {
			expect(shouldTriggerLeech(5, T)).toBe(true);
		});

		it("fires at 100", () => {
			expect(shouldTriggerLeech(100, T)).toBe(true);
		});
	});

	describe("threshold=2 (halfThreshold=max(1,1)=1 — fires at 2, 3, 4, ...)", () => {
		const T = 2;

		it("does not fire at 1", () => {
			expect(shouldTriggerLeech(1, T)).toBe(false);
		});

		it("fires at 2", () => {
			expect(shouldTriggerLeech(2, T)).toBe(true);
		});

		it("fires at 3", () => {
			expect(shouldTriggerLeech(3, T)).toBe(true);
		});

		it("fires at 4", () => {
			expect(shouldTriggerLeech(4, T)).toBe(true);
		});
	});

	describe("threshold=3 (halfThreshold=ceil(1.5)=2)", () => {
		const T = 3;

		it("fires at 3", () => {
			expect(shouldTriggerLeech(3, T)).toBe(true);
		});

		it("does not fire at 4", () => {
			expect(shouldTriggerLeech(4, T)).toBe(false);
		});

		it("fires at 5 (3+2)", () => {
			expect(shouldTriggerLeech(5, T)).toBe(true);
		});

		it("fires at 7 (3+4)", () => {
			expect(shouldTriggerLeech(7, T)).toBe(true);
		});
	});
});
