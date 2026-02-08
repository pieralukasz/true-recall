import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { State } from "ts-fsrs";
import {
	createTestContext,
	createTestCard,
	type TestContext,
} from "../persistence/sqlite/__setup__/test-database";
import { CardRepository } from "../../../src/services/flashcard/card-repository.service";
import { FlashcardManager } from "../../../src/services/flashcard/flashcard.service";
import type { SqliteStoreService } from "../../../src/services/persistence/sqlite/SqliteStoreService";
import type { App } from "obsidian";

const mockEventBus = {
	emit: vi.fn(),
	on: () => () => {},
};

vi.mock("../../../src/services/core/event-bus.service", () => ({
	getEventBus: () => mockEventBus,
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
		mockEventBus.emit.mockClear();
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
		expect(mockEventBus.emit).not.toHaveBeenCalled();
	});

	it("should cascade soft delete to review_log", () => {
		const card = createTestCard({ id: "card-1" });
		ctx.cards.set(card.id, card);
		ctx.stats.addReviewLog("card-1", 3, 7, 0, State.Review, 5000);

		expect(ctx.stats.getTotalReviewCount()).toBe(1);

		repository.deleteBatch(["card-1"]);

		expect(ctx.stats.getTotalReviewCount()).toBe(0);
	});

	it("should emit single cards:bulk-change event", () => {
		const cards = [
			createTestCard({ id: "card-1" }),
			createTestCard({ id: "card-2" }),
		];
		cards.forEach((c) => ctx.cards.set(c.id, c));

		repository.deleteBatch(["card-1", "card-2"]);

		expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
		expect(mockEventBus.emit).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "cards:bulk-change",
				action: "removed",
				cardIds: ["card-1", "card-2"],
			})
		);
	});

	it("should NOT emit individual card:removed events", () => {
		const cards = [
			createTestCard({ id: "card-1" }),
			createTestCard({ id: "card-2" }),
		];
		cards.forEach((c) => ctx.cards.set(c.id, c));

		repository.deleteBatch(["card-1", "card-2"]);

		const calls = mockEventBus.emit.mock.calls;
		const removedEvents = calls.filter(
			(call: unknown[]) => (call[0] as { type: string }).type === "card:removed"
		);
		expect(removedEvents).toHaveLength(0);
	});
});

describe("FlashcardManager.removeFlashcardsByIds", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
		mockEventBus.emit.mockClear();
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
