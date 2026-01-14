/**
 * Tests for FSRS utility functions in fsrs.types.ts
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { State } from "ts-fsrs";
import {
	createDefaultFSRSData,
	createDefaultSessionState,
	formatInterval,
	formatIntervalDays,
} from "../../src/types";

describe("fsrs.types utilities", () => {
	describe("createDefaultFSRSData", () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should create card with New state (0)", () => {
			const card = createDefaultFSRSData("test-id");
			expect(card.state).toBe(State.New);
			expect(card.state).toBe(0);
		});

		it("should preserve the provided ID", () => {
			const card = createDefaultFSRSData("my-unique-id");
			expect(card.id).toBe("my-unique-id");
		});

		it("should set all numeric values to zero", () => {
			const card = createDefaultFSRSData("test-id");
			expect(card.stability).toBe(0);
			expect(card.difficulty).toBe(0);
			expect(card.reps).toBe(0);
			expect(card.lapses).toBe(0);
			expect(card.scheduledDays).toBe(0);
			expect(card.learningStep).toBe(0);
		});

		it("should set lastReview to null", () => {
			const card = createDefaultFSRSData("test-id");
			expect(card.lastReview).toBeNull();
		});

		it("should set due date to current time", () => {
			const card = createDefaultFSRSData("test-id");
			expect(card.due).toBe("2024-01-15T10:00:00.000Z");
		});

		it("should set createdAt timestamp", () => {
			const card = createDefaultFSRSData("test-id");
			expect(card.createdAt).toBe(Date.now());
		});
	});

	describe("createDefaultSessionState", () => {
		it("should create inactive session by default", () => {
			const state = createDefaultSessionState();
			expect(state.isActive).toBe(false);
		});

		it("should have empty queue", () => {
			const state = createDefaultSessionState();
			expect(state.queue).toEqual([]);
			expect(state.currentIndex).toBe(0);
		});

		it("should have answer hidden", () => {
			const state = createDefaultSessionState();
			expect(state.isAnswerRevealed).toBe(false);
		});

		it("should have empty results array", () => {
			const state = createDefaultSessionState();
			expect(state.results).toEqual([]);
		});

		it("should have zero timestamps", () => {
			const state = createDefaultSessionState();
			expect(state.startTime).toBe(0);
			expect(state.questionShownTime).toBe(0);
		});

		it("should have zero stats", () => {
			const state = createDefaultSessionState();
			expect(state.stats).toEqual({
				total: 0,
				reviewed: 0,
				again: 0,
				hard: 0,
				good: 0,
				easy: 0,
				newCards: 0,
				learningCards: 0,
				reviewCards: 0,
				duration: 0,
			});
		});
	});

	describe("formatInterval", () => {
		describe("sub-minute intervals", () => {
			it('should return "<1m" for 0 minutes', () => {
				expect(formatInterval(0)).toBe("<1m");
			});

			it('should return "<1m" for 0.5 minutes', () => {
				expect(formatInterval(0.5)).toBe("<1m");
			});

			it('should return "<1m" for 0.99 minutes', () => {
				expect(formatInterval(0.99)).toBe("<1m");
			});
		});

		describe("minute intervals", () => {
			it("should return exact minutes for 1 minute", () => {
				expect(formatInterval(1)).toBe("1m");
			});

			it("should return minutes for values under 60", () => {
				expect(formatInterval(10)).toBe("10m");
				expect(formatInterval(30)).toBe("30m");
				expect(formatInterval(59)).toBe("59m");
			});

			it("should round fractional minutes", () => {
				expect(formatInterval(10.4)).toBe("10m");
				expect(formatInterval(10.6)).toBe("11m");
			});
		});

		describe("hour intervals", () => {
			it("should convert 60 minutes to 1h", () => {
				expect(formatInterval(60)).toBe("1h");
			});

			it("should handle multiple hours", () => {
				expect(formatInterval(120)).toBe("2h");
				expect(formatInterval(180)).toBe("3h");
			});

			it("should round to nearest hour", () => {
				expect(formatInterval(90)).toBe("2h"); // 1.5 hours rounds to 2
				expect(formatInterval(150)).toBe("3h"); // 2.5 hours rounds to 3
			});

			it("should return hours up to 23h", () => {
				expect(formatInterval(23 * 60)).toBe("23h");
			});
		});

		describe("day intervals", () => {
			it("should convert 24 hours to 1d", () => {
				expect(formatInterval(24 * 60)).toBe("1d");
			});

			it("should handle multiple days", () => {
				expect(formatInterval(2 * 24 * 60)).toBe("2d");
				expect(formatInterval(7 * 24 * 60)).toBe("7d");
				expect(formatInterval(14 * 24 * 60)).toBe("14d");
			});

			it("should return days up to 29d", () => {
				expect(formatInterval(29 * 24 * 60)).toBe("29d");
			});
		});

		describe("month intervals", () => {
			it("should convert 30 days to 1mo", () => {
				expect(formatInterval(30 * 24 * 60)).toBe("1mo");
			});

			it("should handle multiple months", () => {
				expect(formatInterval(60 * 24 * 60)).toBe("2mo");
				expect(formatInterval(90 * 24 * 60)).toBe("3mo");
				expect(formatInterval(180 * 24 * 60)).toBe("6mo");
			});

			it("should return months up to 11mo", () => {
				expect(formatInterval(330 * 24 * 60)).toBe("11mo");
			});
		});

		describe("year intervals", () => {
			it("should convert 365 days to 1y", () => {
				expect(formatInterval(365 * 24 * 60)).toBe("1y");
			});

			it("should handle multiple years", () => {
				expect(formatInterval(730 * 24 * 60)).toBe("2y");
				expect(formatInterval(1095 * 24 * 60)).toBe("3y");
			});

			it("should handle large intervals", () => {
				expect(formatInterval(10 * 365 * 24 * 60)).toBe("10y");
			});
		});
	});

	describe("formatIntervalDays", () => {
		it("should convert days to minutes and format", () => {
			// 1 day = 1440 minutes = "1d"
			expect(formatIntervalDays(1)).toBe("1d");
		});

		it("should handle fractional days", () => {
			// 0.5 day = 720 minutes = 12 hours
			expect(formatIntervalDays(0.5)).toBe("12h");
		});

		it("should handle zero days", () => {
			// 0 days = 0 minutes = "<1m"
			expect(formatIntervalDays(0)).toBe("<1m");
		});

		it("should handle multiple days", () => {
			expect(formatIntervalDays(7)).toBe("7d");
			expect(formatIntervalDays(30)).toBe("1mo");
			expect(formatIntervalDays(365)).toBe("1y");
		});

		it("should handle small fractional days", () => {
			// 1/24 day = 1 hour = 60 minutes
			expect(formatIntervalDays(1 / 24)).toBe("1h");
		});
	});
});
