/**
 * Tests for card state helpers
 */

import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import {
	aggregateCardStateCounts,
	countCardsByState,
	countCardsByStateWithDue,
	filterActiveCardsOnly,
	isCardBuried,
} from "../../src/helpers/card-state";
import type { FSRSFlashcardItem } from "../../src/types";

// Helper to create mock FSRS card
function createMockFsrsCard(
	overrides: Partial<FSRSFlashcardItem> = {},
): FSRSFlashcardItem {
	return {
		id: "test-id",
		question: "Test question",
		answer: "Test answer",
		sourceUid: "source-uid",
		fsrs: {
			state: State.New,
			due: new Date().toISOString(),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			suspended: false,
			buriedUntil: undefined,
		},
		...overrides,
	} as FSRSFlashcardItem;
}

// Helper to create mock raw card (for filtering)
function createMockRawCard(
	overrides: Partial<{ suspended?: boolean; buriedUntil?: string | null }> = {},
) {
	return {
		id: "test-id",
		suspended: false,
		buriedUntil: null,
		...overrides,
	};
}

describe("filterActiveCardsOnly", () => {
	it("should filter out suspended cards", () => {
		const cards = [
			createMockRawCard({ suspended: false }),
			createMockRawCard({ suspended: true }),
			createMockRawCard({ suspended: false }),
		];

		const result = filterActiveCardsOnly(cards);

		expect(result).toHaveLength(2);
	});

	it("should filter out buried cards (future buriedUntil)", () => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);

		const cards = [
			createMockRawCard({ buriedUntil: null }),
			createMockRawCard({ buriedUntil: tomorrow.toISOString() }),
		];

		const result = filterActiveCardsOnly(cards);

		expect(result).toHaveLength(1);
	});

	it("should include cards with expired buriedUntil", () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		const cards = [createMockRawCard({ buriedUntil: yesterday.toISOString() })];

		const result = filterActiveCardsOnly(cards);

		expect(result).toHaveLength(1);
	});

	it("should use custom now date when provided", () => {
		const now = new Date("2024-01-15");
		const before = new Date("2024-01-10").toISOString();
		const after = new Date("2024-01-20").toISOString();

		const cards = [
			createMockRawCard({ buriedUntil: before }), // Should be included (expired)
			createMockRawCard({ buriedUntil: after }), // Should be excluded (future)
		];

		const result = filterActiveCardsOnly(cards, { now });

		expect(result).toHaveLength(1);
	});
});

describe("isCardBuried", () => {
	const now = new Date("2026-01-15T10:00:00Z");

	it.each([
		["no bury boundary", undefined, false],
		["null bury boundary", null, false],
		["elapsed bury boundary", "2026-01-14T10:00:00Z", false],
		["future bury boundary", "2026-01-16T10:00:00Z", true],
	])("returns %s => %s", (_label, buriedUntil, expected) => {
		expect(isCardBuried(buriedUntil, now)).toBe(expected);
	});
});

describe("countCardsByState", () => {
	it("should count new cards", () => {
		const cards = [
			createMockFsrsCard({
				fsrs: { ...createMockFsrsCard().fsrs, state: State.New },
			}),
			createMockFsrsCard({
				fsrs: { ...createMockFsrsCard().fsrs, state: State.New },
			}),
		];

		const counts = countCardsByState(cards);

		expect(counts.new).toBe(2);
		expect(counts.learning).toBe(0);
		expect(counts.review).toBe(0);
	});

	it("should count learning and relearning cards together", () => {
		const cards = [
			createMockFsrsCard({
				fsrs: { ...createMockFsrsCard().fsrs, state: State.Learning },
			}),
			createMockFsrsCard({
				fsrs: { ...createMockFsrsCard().fsrs, state: State.Relearning },
			}),
		];

		const counts = countCardsByState(cards);

		expect(counts.learning).toBe(2);
	});

	it("should count review cards", () => {
		const cards = [
			createMockFsrsCard({
				fsrs: { ...createMockFsrsCard().fsrs, state: State.Review },
			}),
		];

		const counts = countCardsByState(cards);

		expect(counts.review).toBe(1);
	});

	it("should skip suspended cards", () => {
		const cards = [
			createMockFsrsCard({
				fsrs: {
					...createMockFsrsCard().fsrs,
					state: State.New,
					suspended: true,
				},
			}),
		];

		const counts = countCardsByState(cards);

		expect(counts.new).toBe(0);
	});

	it("should skip buried cards", () => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);

		const cards = [
			createMockFsrsCard({
				fsrs: {
					...createMockFsrsCard().fsrs,
					state: State.New,
					buriedUntil: tomorrow.toISOString(),
				},
			}),
		];

		const counts = countCardsByState(cards);

		expect(counts.new).toBe(0);
	});
});

describe("countCardsByStateWithDue", () => {
	it("should count due cards correctly", () => {
		const now = new Date();
		const tomorrowBoundary = new Date(now);
		tomorrowBoundary.setDate(tomorrowBoundary.getDate() + 1);
		tomorrowBoundary.setHours(4, 0, 0, 0); // Anki-style 4 AM boundary

		const dueYesterday = new Date(now);
		dueYesterday.setDate(dueYesterday.getDate() - 1);

		const dueTomorrow = new Date(now);
		dueTomorrow.setDate(dueTomorrow.getDate() + 2);

		const cards = [
			{
				state: State.Review,
				due: dueYesterday.toISOString(),
				suspended: false,
				buriedUntil: null,
			},
			{
				state: State.Review,
				due: dueTomorrow.toISOString(),
				suspended: false,
				buriedUntil: null,
			},
		];

		const counts = countCardsByStateWithDue(cards, tomorrowBoundary);

		expect(counts.review).toBe(2);
		expect(counts.due).toBe(1); // Only the card due yesterday
	});
});

describe("aggregateCardStateCounts", () => {
	it("should aggregate counts from multiple sources", () => {
		const counts1 = { new: 5, learning: 3, review: 10 };
		const counts2 = { new: 2, learning: 1, review: 5 };
		const counts3 = { new: 1, learning: 0, review: 2 };

		const result = aggregateCardStateCounts([counts1, counts2, counts3]);

		expect(result.new).toBe(8);
		expect(result.learning).toBe(4);
		expect(result.review).toBe(17);
	});

	it("should return zeros for empty array", () => {
		const result = aggregateCardStateCounts([]);

		expect(result.new).toBe(0);
		expect(result.learning).toBe(0);
		expect(result.review).toBe(0);
	});
});
