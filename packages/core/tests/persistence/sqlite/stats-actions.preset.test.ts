import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	createTestContext,
	createTestCard,
	type TestContext,
} from "./__setup__/test-database";

function addReview(
	ctx: TestContext,
	cardId: string,
	presetName?: string,
	state = 2,
): void {
	ctx.stats.addReviewLog(cardId, 3, 7, 0, state, 5000, presetName);
}

function softDeleteReview(ctx: TestContext, reviewId: string): void {
	ctx.db.run(`UPDATE review_log SET deleted_at = ? WHERE id = ?`, [
		Date.now(),
		reviewId,
	]);
}

function getReviewIds(ctx: TestContext, cardId: string): string[] {
	const rows = ctx.db.query<{ id: string }>(
		`SELECT id FROM review_log WHERE card_id = ? ORDER BY rowid`,
		[cardId],
	);
	return rows.map((r) => r.id);
}

describe("StatsActions — preset methods", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-01T10:00:00Z"));
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	describe("getReviewCountForPreset", () => {
		it("returns 0 when no reviews exist", () => {
			expect(ctx.stats.getReviewCountForPreset("Default")).toBe(0);
		});

		it("counts reviews matching the exact preset name", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "Medical");
			addReview(ctx, "card-1", "Medical");
			addReview(ctx, "card-1", "Medical");

			expect(ctx.stats.getReviewCountForPreset("Medical")).toBe(3);
		});

		it("does not count reviews with a different preset name", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "Medical");
			addReview(ctx, "card-1", "Science");
			addReview(ctx, "card-1", "Medical");

			expect(ctx.stats.getReviewCountForPreset("Medical")).toBe(2);
			expect(ctx.stats.getReviewCountForPreset("Science")).toBe(1);
		});

		it("for 'Default' preset, also counts rows where preset_name IS NULL", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", undefined); // NULL preset_name
			addReview(ctx, "card-1", undefined);

			expect(ctx.stats.getReviewCountForPreset("Default")).toBe(2);
		});

		it("for 'Default' preset, counts both named 'Default' and NULL rows", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "Default");
			addReview(ctx, "card-1", "Default");
			addReview(ctx, "card-1", "Default");
			addReview(ctx, "card-1", undefined); // NULL
			addReview(ctx, "card-1", undefined); // NULL

			expect(ctx.stats.getReviewCountForPreset("Default")).toBe(5);
		});

		it("for non-Default presets, does NOT include NULL rows", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "Medical");
			addReview(ctx, "card-1", undefined); // NULL
			addReview(ctx, "card-1", undefined); // NULL

			expect(ctx.stats.getReviewCountForPreset("Medical")).toBe(1);
		});

		it("ignores soft-deleted reviews", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "Medical");
			addReview(ctx, "card-1", "Medical");

			const ids = getReviewIds(ctx, "card-1");
			softDeleteReview(ctx, ids[0]!);

			expect(ctx.stats.getReviewCountForPreset("Medical")).toBe(1);
		});
	});

	describe("updateReviewLogPresetName", () => {
		it("renames all matching rows from oldName to newName", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "OldName");
			addReview(ctx, "card-1", "OldName");
			addReview(ctx, "card-1", "OldName");

			ctx.stats.updateReviewLogPresetName("OldName", "NewName");

			expect(ctx.stats.getReviewCountForPreset("OldName")).toBe(0);
			expect(ctx.stats.getReviewCountForPreset("NewName")).toBe(3);
		});

		it("does not affect rows with a different preset name", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "Keep");
			addReview(ctx, "card-1", "Rename");

			ctx.stats.updateReviewLogPresetName("Rename", "Renamed");

			expect(ctx.stats.getReviewCountForPreset("Keep")).toBe(1);
			expect(ctx.stats.getReviewCountForPreset("Renamed")).toBe(1);
		});

		it("does not affect rows with preset_name IS NULL", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", undefined);
			addReview(ctx, "card-1", "Rename");

			ctx.stats.updateReviewLogPresetName("Rename", "Renamed");

			// NULL rows should still be counted by Default (backward compat)
			expect(ctx.stats.getReviewCountForPreset("Default")).toBe(1);
			expect(ctx.stats.getReviewCountForPreset("Renamed")).toBe(1);
		});

		it("updates updated_at timestamp on affected rows", () => {
			const card = createTestCard({ id: "card-1" });
			ctx.cards.set(card.id, card);

			addReview(ctx, "card-1", "OldName");
			const ids = getReviewIds(ctx, "card-1");
			const before = ctx.db.get<{ updated_at: number }>(
				`SELECT updated_at FROM review_log WHERE id = ?`,
				[ids[0]!],
			);

			// Advance time
			vi.setSystemTime(new Date("2026-03-02T10:00:00Z"));

			ctx.stats.updateReviewLogPresetName("OldName", "NewName");

			const after = ctx.db.get<{ updated_at: number }>(
				`SELECT updated_at FROM review_log WHERE id = ?`,
				[ids[0]!],
			);

			expect(after!.updated_at).toBeGreaterThan(before!.updated_at);
		});
	});

	describe("getPresetProgressInRange", () => {
		it("aggregates new/review progress per preset in a time range", () => {
			const cardA = createTestCard({ id: "card-a" });
			const cardB = createTestCard({ id: "card-b" });
			ctx.cards.set(cardA.id, cardA);
			ctx.cards.set(cardB.id, cardB);

			// Outside range (before day boundary)
			vi.setSystemTime(new Date("2026-03-01T03:59:59.000Z"));
			addReview(ctx, cardA.id, "Medical", 0);

			// In range
			vi.setSystemTime(new Date("2026-03-01T04:01:00.000Z"));
			addReview(ctx, cardA.id, "Medical", 0); // new

			vi.setSystemTime(new Date("2026-03-01T04:10:00.000Z"));
			addReview(ctx, cardA.id, "Medical", 2); // review

			vi.setSystemTime(new Date("2026-03-01T05:00:00.000Z"));
			addReview(ctx, cardB.id, undefined, 0); // Default (NULL) new

			vi.setSystemTime(new Date("2026-03-01T05:05:00.000Z"));
			addReview(ctx, cardB.id, undefined, 2); // Default (NULL) review

			const rows = ctx.stats.getPresetProgressInRange(
				"2026-03-01T04:00:00.000Z",
				"2026-03-02T04:00:00.000Z",
			);
			const byPreset = new Map(rows.map((row) => [row.presetName, row]));

			expect(byPreset.get("Medical")).toMatchObject({
				newStudied: 1,
				reviewsCompleted: 1,
			});
			expect(byPreset.get("Default")).toMatchObject({
				newStudied: 1,
				reviewsCompleted: 1,
			});
		});

		it("ignores soft-deleted rows", () => {
			const card = createTestCard({ id: "card-soft-delete" });
			ctx.cards.set(card.id, card);

			vi.setSystemTime(new Date("2026-03-01T10:00:00.000Z"));
			addReview(ctx, card.id, "Medical", 2);
			addReview(ctx, card.id, "Medical", 2);

			const ids = getReviewIds(ctx, card.id);
			softDeleteReview(ctx, ids[0]!);

			const rows = ctx.stats.getPresetProgressInRange(
				"2026-03-01T04:00:00.000Z",
				"2026-03-02T04:00:00.000Z",
			);
			const medical = rows.find((row) => row.presetName === "Medical");

			expect(medical).toBeDefined();
			expect(medical?.reviewsCompleted).toBe(1);
		});
	});
});
