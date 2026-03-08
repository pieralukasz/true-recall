/**
 * Tests for session helpers
 */
import { describe, it, expect, vi } from "vitest";
import {
	applyMutation,
	buildGlobalPresetQueueContext,
	filterActiveCards,
	getEmptyQueueMessage,
	isGlobalReviewSession,
} from "../../../src/features/study/ui/review/helpers/session-helpers";
import type { SqliteStoreService } from "../../../src/features/core/persistence/sqlite";
import type { FlashcardManager } from "../../../src/features/study/services/flashcard/flashcard.service";
import type { ReviewApi } from "../../../src/shared/store";
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem } from "../../../src/shared/types";
import type { FSRSPreset } from "../../../src/shared/types/settings.types";
import type { SessionPersistenceService } from "../../../src/features/core/persistence/session-persistence.service";

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

	it("should return congratulations message by default", () => {
		const message = getEmptyQueueMessage();
		expect(message).toBe("Congratulations! No cards due for review.");
	});
});

function createPreset(
	name: string,
	overrides: Partial<FSRSPreset> = {},
): FSRSPreset {
	return {
		id: `${name.toLowerCase()}-id`,
		name,
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay: 20,
		reviewsPerDay: 200,
		createdAt: Date.now(),
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
		newCardOrder: "random",
		reviewOrder: "due-date",
		newReviewMix: "mix-with-reviews",
		...overrides,
	};
}

describe("isGlobalReviewSession", () => {
	it("returns true for empty filters", () => {
		expect(isGlobalReviewSession({})).toBe(true);
	});

	it("returns false for scoped sessions", () => {
		expect(isGlobalReviewSession({ projectPath: "Projects/A.md" })).toBe(false);
		expect(isGlobalReviewSession({ sourceUidFilter: "uid-a" })).toBe(false);
		expect(isGlobalReviewSession({ sourceNoteFilter: "Note A" })).toBe(false);
		expect(isGlobalReviewSession({ sourceNoteFilters: ["Note A"] })).toBe(false);
		expect(isGlobalReviewSession({ filePathFilter: "Notes/A.md" })).toBe(false);
	});

	it("returns false for custom filters", () => {
		expect(isGlobalReviewSession({ overdueOnly: true })).toBe(false);
		expect(isGlobalReviewSession({ cardLimit: 25 })).toBe(false);
		expect(isGlobalReviewSession({ customReviewOrder: "most-lapses" })).toBe(
			false,
		);
	});
});

describe("buildGlobalPresetQueueContext", () => {
	it("builds card->preset map and merges limits/progress", () => {
		const defaultPreset = createPreset("Default", {
			newCardsPerDay: 15,
			reviewsPerDay: 40,
		});
		const proPreset = createPreset("Pro", {
			newCardsPerDay: 50,
			reviewsPerDay: 300,
		});

		const cards: FSRSFlashcardItem[] = [
			createMockCard({ id: "c-default", sourceUid: "default-uid" }),
			createMockCard({ id: "c-pro", sourceUid: "pro-uid" }),
		];

		const presetService = {
			getPresets: () => [defaultPreset, proPreset],
			getDefaultPreset: () => defaultPreset,
			resolvePresetForCard: (card: FSRSFlashcardItem) =>
				card.sourceUid === "pro-uid" ? proPreset : defaultPreset,
		};

		const sessionPersistence = {
			getTodayProgressByPreset: () =>
				new Map([
					["Default", { newStudied: 3, reviewsCompleted: 9 }],
					["Pro", { newStudied: 7, reviewsCompleted: 11 }],
				]),
		} as unknown as SessionPersistenceService;

		const result = buildGlobalPresetQueueContext(
			cards,
			presetService,
			sessionPersistence,
		);

		expect(result.defaultPresetName).toBe("Default");
		expect(result.cardPresetById.get("c-default")).toBe("Default");
		expect(result.cardPresetById.get("c-pro")).toBe("Pro");
		expect(result.presetDailyLimits.get("Default")).toEqual({
			newCardsPerDay: 15,
			reviewsPerDay: 40,
		});
		expect(result.presetDailyLimits.get("Pro")).toEqual({
			newCardsPerDay: 50,
			reviewsPerDay: 300,
		});
		expect(result.presetProgressToday.get("Default")).toEqual({
			newStudied: 3,
			reviewsCompleted: 9,
		});
		expect(result.presetProgressToday.get("Pro")).toEqual({
			newStudied: 7,
			reviewsCompleted: 11,
		});
	});

	it("maps legacy 'Default' progress to renamed default preset", () => {
		const renamedDefault = createPreset("My Default", {
			newCardsPerDay: 10,
			reviewsPerDay: 20,
		});
		const cards: FSRSFlashcardItem[] = [
			createMockCard({ id: "c-1", sourceUid: "x" }),
		];
		const presetService = {
			getPresets: () => [renamedDefault],
			getDefaultPreset: () => renamedDefault,
			resolvePresetForCard: () => renamedDefault,
		};
		const sessionPersistence = {
			getTodayProgressByPreset: () =>
				new Map([["Default", { newStudied: 2, reviewsCompleted: 5 }]]),
		} as unknown as SessionPersistenceService;

		const result = buildGlobalPresetQueueContext(
			cards,
			presetService,
			sessionPersistence,
		);

		expect(result.presetProgressToday.get("My Default")).toEqual({
			newStudied: 2,
			reviewsCompleted: 5,
		});
	});
});

describe("applyMutation", () => {
	it("does not enqueue added card when sourceUidFilter does not match", () => {
		const addCardToQueue = vi.fn();
		const review = {
			queue: [],
			addCardToQueue,
		} as unknown as ReviewApi;

		const card = createMockCard({ id: "c-1", sourceUid: "uid-other" });
		const flashcardManager = {
			getCardsByIds: () => [card],
		} as unknown as FlashcardManager;

		applyMutation(
			{ type: "added", cardId: "c-1" },
			review,
			flashcardManager,
			{} as SqliteStoreService,
			{ sourceUidFilter: "uid-target" },
		);

		expect(addCardToQueue).not.toHaveBeenCalled();
	});

	it("enqueues added card when sourceUidFilter matches", () => {
		const addCardToQueue = vi.fn();
		const review = {
			queue: [],
			addCardToQueue,
		} as unknown as ReviewApi;

		const card = createMockCard({ id: "c-2", sourceUid: "uid-target" });
		const flashcardManager = {
			getCardsByIds: () => [card],
		} as unknown as FlashcardManager;

		applyMutation(
			{ type: "added", cardId: "c-2" },
			review,
			flashcardManager,
			{} as SqliteStoreService,
			{ sourceUidFilter: "uid-target" },
		);

		expect(addCardToQueue).toHaveBeenCalledOnce();
		expect(addCardToQueue).toHaveBeenCalledWith(card);
	});

	it("removes queued cards for bulk removed action", () => {
		const removeCardsByIds = vi.fn();
		const review = {
			queue: [createMockCard({ id: "c-1" }), createMockCard({ id: "c-2" })],
			removeCardsByIds,
		} as unknown as ReviewApi;

		applyMutation(
			{ type: "bulk", action: "removed", cardIds: ["c-2", "c-3"] },
			review,
			{} as FlashcardManager,
			{} as SqliteStoreService,
			{},
		);

		expect(removeCardsByIds).toHaveBeenCalledOnce();
		expect(removeCardsByIds).toHaveBeenCalledWith(["c-2"]);
	});

	it("removes queued cards for legacy bulk delete action", () => {
		const removeCardsByIds = vi.fn();
		const review = {
			queue: [createMockCard({ id: "c-1" }), createMockCard({ id: "c-2" })],
			removeCardsByIds,
		} as unknown as ReviewApi;

		applyMutation(
			{ type: "bulk", action: "delete", cardIds: ["c-1", "c-9"] },
			review,
			{} as FlashcardManager,
			{} as SqliteStoreService,
			{},
		);

		expect(removeCardsByIds).toHaveBeenCalledOnce();
		expect(removeCardsByIds).toHaveBeenCalledWith(["c-1"]);
	});
});
