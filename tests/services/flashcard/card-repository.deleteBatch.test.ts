import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { State } from "ts-fsrs";
import {
	createTestContext,
	createTestCard,
	type TestContext,
} from "../persistence/sqlite/__setup__/test-database";
import { CardRepository } from "../../../src/features/study/services/flashcard/card-repository.service";
import { FlashcardManager } from "../../../src/features/study/services/flashcard/flashcard.service";
import type { SqliteStoreService } from "../../../src/features/core/persistence/sqlite/SqliteStoreService";
import type { App } from "obsidian";

const mockNotifyCardChange = vi.fn();
vi.mock("../../../src/shared/services/signals", () => ({
	notifyCardChange: (...args: unknown[]) => mockNotifyCardChange(...args),
}));

function createMockStore(ctx: TestContext): SqliteStoreService {
	return {
		cards: ctx.cards,
		get: (id: string) => ctx.cards.get(id),
		set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
		has: (id: string) => ctx.cards.has(id),
		isReady: () => true,
	} as unknown as SqliteStoreService;
}

describe("CardRepository.deleteBatch", () => {
	let ctx: TestContext;
	let repository: CardRepository;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
		repository = new CardRepository(createMockStore(ctx));
		mockNotifyCardChange.mockClear();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	it("should soft delete multiple cards", () => {
		const cards = [
			createTestCard({ id: "card-1" }),
			createTestCard({ id: "card-2" }),
			createTestCard({ id: "card-3" }),
		];
		cards.forEach((c) => ctx.cards.set(c.id, c));

		repository.deleteBatch(["card-1", "card-2"]);

		expect(ctx.cards.size()).toBe(1);
		expect(ctx.cards.get("card-3")).toBeDefined();

		const all = ctx.cards.getAllIncludingDeleted();
		expect(all).toHaveLength(3);
	});

	it("should return count of deleted cards", () => {
		const cards = [
			createTestCard({ id: "card-1" }),
			createTestCard({ id: "card-2" }),
		];
		cards.forEach((c) => ctx.cards.set(c.id, c));

		const count = repository.deleteBatch(["card-1", "card-2"]);

		expect(count).toBe(2);
	});

	it("should return 0 for empty array", () => {
		const count = repository.deleteBatch([]);

		expect(count).toBe(0);
		expect(mockNotifyCardChange).not.toHaveBeenCalled();
	});

	it("should cascade soft delete to review_log", () => {
		const card = createTestCard({ id: "card-1" });
		ctx.cards.set(card.id, card);
		ctx.stats.addReviewLog("card-1", 3, 7, 0, State.Review, 5000);

		expect(ctx.stats.getTotalReviewCount()).toBe(1);

		repository.deleteBatch(["card-1"]);

		expect(ctx.stats.getTotalReviewCount()).toBe(0);
	});

	it("should notify single bulk change", () => {
		const cards = [
			createTestCard({ id: "card-1" }),
			createTestCard({ id: "card-2" }),
		];
		cards.forEach((c) => ctx.cards.set(c.id, c));

		repository.deleteBatch(["card-1", "card-2"]);

		expect(mockNotifyCardChange).toHaveBeenCalledTimes(1);
		expect(mockNotifyCardChange).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "bulk",
				action: "removed",
				cardIds: ["card-1", "card-2"],
			})
		);
	});
});

describe("FlashcardManager.removeFlashcardsByIds", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
		mockNotifyCardChange.mockClear();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	it("should return 0 when store not initialized", () => {
		const manager = new FlashcardManager(
			{} as App,
			{} as never,
			{} as never,
		);

		const count = manager.removeFlashcardsByIds(["card-1"]);

		expect(count).toBe(0);
	});

	it("should delete cards via store", () => {
		const manager = new FlashcardManager(
			{} as App,
			{} as never,
			{} as never,
		);
		manager.setStore(createMockStore(ctx));

		const cards = [
			createTestCard({ id: "card-1" }),
			createTestCard({ id: "card-2" }),
		];
		cards.forEach((c) => ctx.cards.set(c.id, c));

		const count = manager.removeFlashcardsByIds(["card-1", "card-2"]);

		expect(count).toBe(2);
		expect(ctx.cards.size()).toBe(0);
	});
});
