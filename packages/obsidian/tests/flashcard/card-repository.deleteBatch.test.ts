import type { App } from "obsidian";
import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardRepository } from "@true-recall/core/flashcard/data/card-repository.service";
import { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";

import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "../../../core/tests/persistence/sqlite/__setup__/test-database";

const mockBusEmit = vi.fn();

function createMockStore(ctx: TestContext): SqliteStoreService {
	return {
		cards: ctx.cards,
		get: (id: string) => ctx.cards.get(id),
		set: (id: string, data: unknown) => ctx.cards.set(id, data as never),
		has: (id: string) => ctx.cards.has(id),
		isReady: () => true,
		getClozeSiblings: (sourceUid: string, clozeTemplate: string) =>
			ctx.cards.getClozeSiblings(sourceUid, clozeTemplate),
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
		repository.setEventBus({
			emit: mockBusEmit,
			on: vi.fn(() => () => {}),
		} as never);
		mockBusEmit.mockClear();
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
		cards.forEach((c) => {
			ctx.cards.set(c.id, c);
		});

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
		cards.forEach((c) => {
			ctx.cards.set(c.id, c);
		});

		const count = repository.deleteBatch(["card-1", "card-2"]);

		expect(count).toBe(2);
	});

	it("should return 0 for empty array", () => {
		const count = repository.deleteBatch([]);

		expect(count).toBe(0);
		expect(mockBusEmit).not.toHaveBeenCalled();
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
		cards.forEach((c) => {
			ctx.cards.set(c.id, c);
		});

		repository.deleteBatch(["card-1", "card-2"]);

		expect(mockBusEmit).toHaveBeenCalledTimes(1);
		expect(mockBusEmit).toHaveBeenCalledWith(
			"cards:bulk",
			expect.objectContaining({
				action: "removed",
				cardIds: ["card-1", "card-2"],
			}),
		);
	});

	it("cascades reverse pair deletion in bulk mode", () => {
		const original = createTestCard({ id: "card-original" });
		ctx.cards.set(original.id, original);
		const reverse = {
			...createTestCard({ id: "card-reverse" }),
			cardType: "reversed" as const,
			reverseOf: "card-original",
		};
		ctx.cards.set(reverse.id, reverse);

		const count = repository.deleteBatch(["card-original"]);

		expect(count).toBe(2);
		expect(ctx.cards.size()).toBe(0);
		expect(mockBusEmit).toHaveBeenCalledWith(
			"cards:bulk",
			expect.objectContaining({
				action: "removed",
				cardIds: expect.arrayContaining(["card-original", "card-reverse"]),
			}),
		);
	});

	it("cascades cloze siblings and deduplicates deleted ids", () => {
		const c1 = {
			...createTestCard({ id: "cloze-1" }),
			cardType: "cloze" as const,
			sourceUid: "src-cloze",
			clozeTemplate: "{{c1::A}} {{c2::B}} {{c3::C}}",
			clozeIndex: 1,
		};
		const c2 = {
			...createTestCard({ id: "cloze-2" }),
			cardType: "cloze" as const,
			sourceUid: "src-cloze",
			clozeTemplate: "{{c1::A}} {{c2::B}} {{c3::C}}",
			clozeIndex: 2,
		};
		const c3 = {
			...createTestCard({ id: "cloze-3" }),
			cardType: "cloze" as const,
			sourceUid: "src-cloze",
			clozeTemplate: "{{c1::A}} {{c2::B}} {{c3::C}}",
			clozeIndex: 3,
		};
		[c1, c2, c3].forEach((c) => {
			ctx.cards.set(c.id, c);
		});

		const count = repository.deleteBatch(["cloze-1", "cloze-2"]);

		expect(count).toBe(3);
		expect(ctx.cards.size()).toBe(0);
		const lastCall = mockBusEmit.mock.calls[mockBusEmit.mock.calls.length - 1];
		const payload = (lastCall?.[1] as { cardIds?: string[] } | undefined) ?? {};
		expect(new Set(payload?.cardIds ?? []).size).toBe(3);
	});
});

describe("FlashcardManager.removeFlashcardsByIds", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
		mockBusEmit.mockClear();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	function createMockStoreLocal(): SqliteStoreService {
		return createMockStore(ctx);
	}

	it("should return 0 when store not initialized", () => {
		const manager = new FlashcardManager({} as App, {} as never, {} as never);

		const count = manager.removeFlashcardsByIds(["card-1"]);

		expect(count).toBe(0);
	});

	it("should delete cards via store", () => {
		const manager = new FlashcardManager({} as App, {} as never, {} as never);
		manager.setStore(createMockStoreLocal());

		const cards = [
			createTestCard({ id: "card-1" }),
			createTestCard({ id: "card-2" }),
		];
		cards.forEach((c) => {
			ctx.cards.set(c.id, c);
		});

		const count = manager.removeFlashcardsByIds(["card-1", "card-2"]);

		expect(count).toBe(2);
		expect(ctx.cards.size()).toBe(0);
	});

	it("cleans reviewed cards with full cascade ids", () => {
		const manager = new FlashcardManager({} as App, {} as never, {} as never);
		manager.setStore(createMockStoreLocal());
		const removeReviewedCards = vi.fn();
		manager.setSessionPersistence({
			removeReviewedCards,
		} as never);

		const original = createTestCard({ id: "cascade-original" });
		ctx.cards.set(original.id, original);
		const reverse = {
			...createTestCard({ id: "cascade-reverse" }),
			cardType: "reversed" as const,
			reverseOf: "cascade-original",
		};
		ctx.cards.set(reverse.id, reverse);

		const count = manager.removeFlashcardsByIds(["cascade-original"]);

		expect(count).toBe(2);
		expect(removeReviewedCards).toHaveBeenCalledTimes(1);
		expect(removeReviewedCards).toHaveBeenCalledWith(
			expect.arrayContaining(["cascade-original", "cascade-reverse"]),
		);
	});

	it("returns detailed affected ids for single delete with cascade", async () => {
		const manager = new FlashcardManager({} as App, {} as never, {} as never);
		manager.setStore(createMockStoreLocal());

		const original = createTestCard({ id: "detail-original" });
		ctx.cards.set(original.id, original);
		const reverse = {
			...createTestCard({ id: "detail-reverse" }),
			cardType: "reversed" as const,
			reverseOf: "detail-original",
		};
		ctx.cards.set(reverse.id, reverse);

		const result =
			await manager.removeFlashcardByIdWithDetails("detail-original");

		expect(result.ok).toBe(true);
		expect(result.affectedCount).toBe(2);
		expect(result.affectedIds).toEqual(
			expect.arrayContaining(["detail-original", "detail-reverse"]),
		);
	});
});
