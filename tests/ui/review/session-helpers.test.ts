/**
 * Tests for session helpers
 */
import { describe, it, expect } from "vitest";
import {
	filterActiveCards,
	getEmptyQueueMessage,
} from "../../../src/features/study/ui/review/helpers/session-helpers";
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../../src/shared/types";

// Helper to create mock card
function createMockCard(overrides: Partial<FSRSFlashcardItem> = {}): FSRSFlashcardItem {
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

describe("filterActiveCards", () => {
	it("should filter out suspended cards", () => {
		const cards = [
			createMockCard({ id: "1" }),
			createMockCard({
				id: "2",
				fsrs: {
					...createMockCard().fsrs,
					suspended: true,
				},
			}),
			createMockCard({ id: "3" }),
		];

		const result = filterActiveCards(cards);

		expect(result).toHaveLength(2);
		expect(result.map((c) => c.id)).toEqual(["1", "3"]);
	});

	it("should filter out buried cards in normal mode", () => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);

		const cards = [
			createMockCard({ id: "1" }),
			createMockCard({
				id: "2",
				fsrs: {
					...createMockCard().fsrs,
					buriedUntil: tomorrow.toISOString(),
				},
			}),
		];

		const result = filterActiveCards(cards);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("1");
	});

	it("should include only buried cards when stateFilter is buried", () => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);

		const cards = [
			createMockCard({ id: "1" }), // Not buried
			createMockCard({
				id: "2",
				fsrs: {
					...createMockCard().fsrs,
					buriedUntil: tomorrow.toISOString(),
				},
			}),
		];

		const result = filterActiveCards(cards, { stateFilter: "buried" });

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("2");
	});

	it("should include cards with expired buried date", () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		const cards = [
			createMockCard({
				id: "1",
				fsrs: {
					...createMockCard().fsrs,
					buriedUntil: yesterday.toISOString(),
				},
			}),
		];

		const result = filterActiveCards(cards);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("1");
	});
});

describe("getEmptyQueueMessage", () => {
	it("should return buried message for buried filter", () => {
		const message = getEmptyQueueMessage("buried");
		expect(message).toBe("No buried cards found.");
	});

	it("should return project message when project filters active", () => {
		const message = getEmptyQueueMessage(undefined, ["Project A"]);
		expect(message).toBe("No cards due for review in selected projects.");
	});

	it("should return congratulations message by default", () => {
		const message = getEmptyQueueMessage();
		expect(message).toBe("Congratulations! No cards due for review.");
	});
});
