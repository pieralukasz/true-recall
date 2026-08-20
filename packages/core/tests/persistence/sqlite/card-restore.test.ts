import { describe, expect, it } from "vitest";

import {
	createTestCard,
	createTestContext,
	getRawCard,
	type TestContext,
} from "./__setup__/test-database";

function getReviewLogDeletedAt(ctx: TestContext, logId: string): number | null {
	return (
		ctx.db.get<{ deleted_at: number | null }>(
			`SELECT deleted_at FROM review_log WHERE id = ?`,
			[logId],
		)?.deleted_at ?? null
	);
}

describe("restoreWithCascade", () => {
	it("revives a soft-deleted card", async () => {
		const ctx = await createTestContext();
		const card = createTestCard({ id: "card-1" });
		ctx.cards.set(card.id, card);

		ctx.cards.softDeleteWithCascade(card.id);
		expect(ctx.cards.get(card.id)).toBeUndefined();

		ctx.cards.restoreWithCascade(card.id);
		expect(getRawCard(ctx.db, card.id)?.deleted_at).toBeNull();
		expect(ctx.cards.get(card.id)?.id).toBe(card.id);
		ctx.close();
	});

	it("revives review_log rows tombstoned by the same cascade", async () => {
		const ctx = await createTestContext();
		const card = createTestCard({ id: "card-1" });
		ctx.cards.set(card.id, card);
		const logId = ctx.stats.addReviewLog(card.id, 3, 1, 0, 1, 1000);

		ctx.cards.softDeleteWithCascade(card.id);
		expect(getReviewLogDeletedAt(ctx, logId)).not.toBeNull();

		ctx.cards.restoreWithCascade(card.id);
		expect(getReviewLogDeletedAt(ctx, logId)).toBeNull();
		ctx.close();
	});

	it("keeps individually tombstoned review entries deleted", async () => {
		const ctx = await createTestContext();
		const card = createTestCard({ id: "card-1" });
		ctx.cards.set(card.id, card);
		const undoneLogId = ctx.stats.addReviewLog(card.id, 3, 1, 0, 1, 1000);
		ctx.stats.markReviewLogDeleted(undoneLogId);
		const tombstonedAt = getReviewLogDeletedAt(ctx, undoneLogId);
		expect(tombstonedAt).not.toBeNull();

		// The cascade stamps a later deleted_at on the card; only rows carrying
		// that same stamp may be revived.
		await new Promise((resolve) => setTimeout(resolve, 2));
		ctx.cards.softDeleteWithCascade(card.id);
		ctx.cards.restoreWithCascade(card.id);

		expect(getReviewLogDeletedAt(ctx, undoneLogId)).toBe(tombstonedAt);
		ctx.close();
	});

	it("is a no-op for a live card", async () => {
		const ctx = await createTestContext();
		const card = createTestCard({ id: "card-1" });
		ctx.cards.set(card.id, card);

		ctx.cards.restoreWithCascade(card.id);
		expect(ctx.cards.get(card.id)?.id).toBe(card.id);
		ctx.close();
	});
});
