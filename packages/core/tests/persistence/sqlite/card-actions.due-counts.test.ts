/**
 * Tests for CardActions.getDueCountsByDateRange
 *
 * Aggregate due-count histogram used by load balancing hot paths.
 * Counts Review-state cards per UTC due day without materializing
 * full card rows (no notes/note_types JOIN).
 */
import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createTestCard,
	createTestContext,
	insertCardDirect,
	type TestContext,
} from "./__setup__/test-database";

describe("CardActions - getDueCountsByDateRange", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
	});

	it("counts only active Review-state cards, grouped by UTC due day", () => {
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "review-a",
				state: State.Review,
				due: "2026-07-20T08:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "review-b",
				state: State.Review,
				due: "2026-07-20T22:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "review-c",
				state: State.Review,
				due: "2026-07-21T10:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "new-card",
				state: State.New,
				due: "2026-07-20T10:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "learning-card",
				state: State.Learning,
				due: "2026-07-20T10:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "suspended-card",
				state: State.Review,
				due: "2026-07-20T10:00:00.000Z",
				suspended: true,
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "buried-card",
				state: State.Review,
				due: "2026-07-20T10:00:00.000Z",
				buriedUntil: "2099-01-01T00:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "out-of-range",
				state: State.Review,
				due: "2026-08-05T10:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "deleted-card",
				state: State.Review,
				due: "2026-07-20T10:00:00.000Z",
			}),
		);
		ctx.db.run(`UPDATE cards SET deleted_at = ? WHERE id = ?`, [
			Date.now(),
			"deleted-card",
		]);

		const counts = ctx.cards.getDueCountsByDateRange(
			"2026-07-19",
			"2026-07-25",
		);

		expect(counts).toEqual([
			{ day: "2026-07-20", count: 2 },
			{ day: "2026-07-21", count: 1 },
		]);
	});

	it("counts a formerly buried card once its buried_until has passed", () => {
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "unburied-card",
				state: State.Review,
				due: "2026-07-20T10:00:00.000Z",
				buriedUntil: "2000-01-01T00:00:00.000Z",
			}),
		);

		const counts = ctx.cards.getDueCountsByDateRange(
			"2026-07-19",
			"2026-07-25",
		);

		expect(counts).toEqual([{ day: "2026-07-20", count: 1 }]);
	});

	it("excludes the given card id from the counts", () => {
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "kept-card",
				state: State.Review,
				due: "2026-07-20T08:00:00.000Z",
			}),
		);
		insertCardDirect(
			ctx.cards,
			createTestCard({
				id: "excluded-card",
				state: State.Review,
				due: "2026-07-20T09:00:00.000Z",
			}),
		);

		const counts = ctx.cards.getDueCountsByDateRange(
			"2026-07-19",
			"2026-07-25",
			"excluded-card",
		);

		expect(counts).toEqual([{ day: "2026-07-20", count: 1 }]);
	});

	it("returns an empty array when no cards match the range", () => {
		const counts = ctx.cards.getDueCountsByDateRange(
			"2026-07-19",
			"2026-07-25",
		);

		expect(counts).toEqual([]);
	});
});
