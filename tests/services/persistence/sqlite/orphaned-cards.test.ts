/**
 * Orphaned Cards Tests
 * Behavior-first tests for orphaned card detection and management
 *
 * Orphaned cards are flashcards that either:
 * 1. Don't have a source_uid (no_source_uid)
 * 2. Have a source_uid that doesn't match any existing file (missing_source_file)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	createTestContext,
	createTestCard,
	createCardWithSource,
	createOrphanedCard,
	type TestContext,
} from "./__setup__/test-database";
import { OrphanedCardsService } from "../../../../src/services/flashcard/orphaned-cards.service";
import type { SqliteStoreService } from "../../../../src/services/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "../../../../src/services/core/frontmatter-index.service";

describe("Orphaned Cards", () => {
	let ctx: TestContext;
	let orphanedService: OrphanedCardsService;

	beforeEach(async () => {
		ctx = await createTestContext();
		orphanedService = new OrphanedCardsService();
	});

	afterEach(() => {
		ctx.close();
	});

	/**
	 * Create a mock store that delegates to our test context
	 */
	function createMockStore(): SqliteStoreService {
		return {
			cards: ctx.cards,
			getOrphanedCards: () => ctx.cards.getOrphanedCards(),
		} as unknown as SqliteStoreService;
	}

	/**
	 * Create a mock FrontmatterIndexService
	 */
	function createMockFrontmatterIndex(
		validSourceUids: string[]
	): FrontmatterIndexService {
		return {
			getFileByValue: (_field: string, value: string) => {
				// Return a mock file if the sourceUid is in the valid list
				if (validSourceUids.includes(value)) {
					return { path: `notes/${value}.md` }; // Mock TFile
				}
				return undefined;
			},
		} as unknown as FrontmatterIndexService;
	}

	describe("Orphan Detection - No Source UID", () => {
		it("should identify cards without source_uid as orphaned", async () => {
			// Card with no source_uid
			const orphan = createOrphanedCard({ id: "orphan-1" });
			ctx.cards.set(orphan.id, orphan);

			// Card with source_uid
			const linked = createCardWithSource("source123", { id: "linked-1" });
			ctx.cards.set(linked.id, linked);

			const mockStore = createMockStore();
			const orphans = orphanedService.getOrphanedCards(mockStore);

			expect(orphans).toHaveLength(1);
			expect(orphans[0]?.id).toBe("orphan-1");
		});

		it("should return empty array when no orphaned cards exist", async () => {
			const linked = createCardWithSource("source123");
			ctx.cards.set(linked.id, linked);

			const mockStore = createMockStore();
			const orphans = orphanedService.getOrphanedCards(mockStore);

			expect(orphans).toHaveLength(0);
		});

		it("should include question and answer in orphaned card info", async () => {
			const orphan = createOrphanedCard({
				id: "orphan-1",
				question: "Test question?",
				answer: "Test answer",
			});
			ctx.cards.set(orphan.id, orphan);

			const mockStore = createMockStore();
			const orphans = orphanedService.getOrphanedCards(mockStore);

			expect(orphans[0]?.question).toBe("Test question?");
			expect(orphans[0]?.answer).toBe("Test answer");
		});
	});

	describe("Orphan Detection - Missing Source File", () => {
		it("should identify cards with missing source file as orphaned", async () => {
			// Card with source_uid pointing to non-existent file
			const card = createCardWithSource("deleted123", { id: "orphan-1" });
			ctx.cards.set(card.id, card);

			const mockStore = createMockStore();
			const mockIndex = createMockFrontmatterIndex([]); // No valid files

			const orphans = orphanedService.getOrphanedCardsExtended(
				mockStore,
				mockIndex
			);

			expect(orphans).toHaveLength(1);
			expect(orphans[0]?.id).toBe("orphan-1");
			expect(orphans[0]?.orphanReason).toBe("missing_source_file");
			expect(orphans[0]?.missingSourceUid).toBe("deleted123");
		});

		it("should NOT flag cards with valid source files as orphaned", async () => {
			const sourceUid = "valid123";
			const card = createCardWithSource(sourceUid, { id: "linked-1" });
			ctx.cards.set(card.id, card);

			const mockStore = createMockStore();
			const mockIndex = createMockFrontmatterIndex([sourceUid]); // This file exists

			const orphans = orphanedService.getOrphanedCardsExtended(
				mockStore,
				mockIndex
			);

			expect(orphans).toHaveLength(0);
		});

		it("should detect both orphan types together", async () => {
			// Type 1: No source_uid
			const noSource = createOrphanedCard({ id: "no-source" });
			ctx.cards.set(noSource.id, noSource);

			// Type 2: Missing source file
			const missingFile = createCardWithSource("deleted123", {
				id: "missing-file",
			});
			ctx.cards.set(missingFile.id, missingFile);

			// Valid card
			const valid = createCardWithSource("valid123", { id: "valid" });
			ctx.cards.set(valid.id, valid);

			const mockStore = createMockStore();
			const mockIndex = createMockFrontmatterIndex(["valid123"]);

			const orphans = orphanedService.getOrphanedCardsExtended(
				mockStore,
				mockIndex
			);

			expect(orphans).toHaveLength(2);

			const noSourceOrphan = orphans.find((o) => o.id === "no-source");
			expect(noSourceOrphan?.orphanReason).toBe("no_source_uid");

			const missingFileOrphan = orphans.find((o) => o.id === "missing-file");
			expect(missingFileOrphan?.orphanReason).toBe("missing_source_file");
		});
	});

	describe("Orphan Grouping", () => {
		it("should group orphans by source_uid", async () => {
			// 3 cards from same deleted note
			const deleted1 = createCardWithSource("deleted123", { id: "card-1" });
			const deleted2 = createCardWithSource("deleted123", { id: "card-2" });
			const deleted3 = createCardWithSource("deleted123", { id: "card-3" });

			// 2 cards from another deleted note
			const deleted4 = createCardWithSource("deleted456", { id: "card-4" });
			const deleted5 = createCardWithSource("deleted456", { id: "card-5" });

			ctx.cards.set(deleted1.id, deleted1);
			ctx.cards.set(deleted2.id, deleted2);
			ctx.cards.set(deleted3.id, deleted3);
			ctx.cards.set(deleted4.id, deleted4);
			ctx.cards.set(deleted5.id, deleted5);

			const mockStore = createMockStore();
			const mockIndex = createMockFrontmatterIndex([]); // No valid files

			const orphans = orphanedService.getOrphanedCardsExtended(
				mockStore,
				mockIndex
			);
			const groups = orphanedService.groupOrphanedCards(orphans);

			expect(groups).toHaveLength(2);

			const group123 = groups.find((g) => g.groupKey === "deleted123");
			expect(group123?.cards).toHaveLength(3);

			const group456 = groups.find((g) => g.groupKey === "deleted456");
			expect(group456?.cards).toHaveLength(2);
		});

		it("should separate no_source_uid cards into own group", async () => {
			// Cards without source_uid
			const noSource1 = createOrphanedCard({ id: "no-source-1" });
			const noSource2 = createOrphanedCard({ id: "no-source-2" });

			// Cards with missing source file
			const missingFile = createCardWithSource("deleted123", {
				id: "missing-file",
			});

			ctx.cards.set(noSource1.id, noSource1);
			ctx.cards.set(noSource2.id, noSource2);
			ctx.cards.set(missingFile.id, missingFile);

			const mockStore = createMockStore();
			const mockIndex = createMockFrontmatterIndex([]);

			const orphans = orphanedService.getOrphanedCardsExtended(
				mockStore,
				mockIndex
			);
			const groups = orphanedService.groupOrphanedCards(orphans);

			expect(groups).toHaveLength(2);

			const noSourceGroup = groups.find((g) => g.groupKey === "no_source_uid");
			expect(noSourceGroup?.cards).toHaveLength(2);
			expect(noSourceGroup?.displayName).toBe("Cards without source note");
			expect(noSourceGroup?.reason).toBe("no_source_uid");

			const deletedGroup = groups.find((g) => g.groupKey === "deleted123");
			expect(deletedGroup?.cards).toHaveLength(1);
			expect(deletedGroup?.reason).toBe("missing_source_file");
		});
	});

	describe("Orphan Resolution", () => {
		it("should assign orphaned card to new source note", async () => {
			const orphan = createOrphanedCard({ id: "orphan-1" });
			ctx.cards.set(orphan.id, orphan);

			// Assign to new source
			const newSourceUid = "target123";
			ctx.cards.updateCardSourceUid(orphan.id, newSourceUid);

			// Card should now have source_uid
			const updated = ctx.cards.get(orphan.id);
			expect(updated?.sourceUid).toBe(newSourceUid);

			// Should no longer appear in orphaned cards (basic check)
			const orphans = ctx.cards.getOrphanedCards();
			expect(orphans).toHaveLength(0);
		});

		it("should soft delete orphaned cards in bulk", async () => {
			const orphan1 = createOrphanedCard({ id: "orphan-1" });
			const orphan2 = createOrphanedCard({ id: "orphan-2" });
			const orphan3 = createOrphanedCard({ id: "orphan-3" });

			ctx.cards.set(orphan1.id, orphan1);
			ctx.cards.set(orphan2.id, orphan2);
			ctx.cards.set(orphan3.id, orphan3);

			// Bulk delete
			for (const id of ["orphan-1", "orphan-2", "orphan-3"]) {
				ctx.cards.softDelete(id);
			}

			// All should be deleted
			expect(ctx.cards.has("orphan-1")).toBe(false);
			expect(ctx.cards.has("orphan-2")).toBe(false);
			expect(ctx.cards.has("orphan-3")).toBe(false);

			// No orphaned cards should remain
			const orphans = ctx.cards.getOrphanedCards();
			expect(orphans).toHaveLength(0);
		});
	});

	describe("Orphan Counting", () => {
		it("should count orphaned cards correctly", async () => {
			const mockStore = createMockStore();

			// Initially no orphans
			expect(orphanedService.countOrphanedCards(mockStore)).toBe(0);

			// Add orphans
			ctx.cards.set("orphan-1", createOrphanedCard({ id: "orphan-1" }));
			ctx.cards.set("orphan-2", createOrphanedCard({ id: "orphan-2" }));

			expect(orphanedService.countOrphanedCards(mockStore)).toBe(2);
		});

		it("should return orphan IDs", async () => {
			const orphan1 = createOrphanedCard({ id: "orphan-a" });
			const orphan2 = createOrphanedCard({ id: "orphan-b" });
			const linked = createCardWithSource("source123", { id: "linked-1" });

			ctx.cards.set(orphan1.id, orphan1);
			ctx.cards.set(orphan2.id, orphan2);
			ctx.cards.set(linked.id, linked);

			const mockStore = createMockStore();
			const ids = orphanedService.getOrphanedCardIds(mockStore);

			expect(ids).toHaveLength(2);
			expect(ids).toContain("orphan-a");
			expect(ids).toContain("orphan-b");
		});
	});

	describe("isOrphaned Helper", () => {
		it("should identify orphaned FSRSCardData", async () => {
			const orphan = createOrphanedCard();
			const linked = createCardWithSource("source123");

			expect(orphanedService.isOrphaned(orphan)).toBe(true);
			expect(orphanedService.isOrphaned(linked)).toBe(false);
		});

		it("should identify orphaned FSRSFlashcardItem", async () => {
			const orphanItem = {
				id: "orphan-1",
				question: "Q",
				answer: "A",
				fsrs: createOrphanedCard(),
				projects: [],
				sourceUid: undefined,
			};

			const linkedItem = {
				id: "linked-1",
				question: "Q",
				answer: "A",
				fsrs: createCardWithSource("source123"),
				projects: [],
				sourceUid: "source123",
			};

			expect(orphanedService.isOrphaned(orphanItem)).toBe(true);
			expect(orphanedService.isOrphaned(linkedItem)).toBe(false);
		});
	});
});
