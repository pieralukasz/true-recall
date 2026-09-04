import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BUILTIN_BASIC_ID } from "../../../src/types/note.types";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "./__setup__/test-database";

describe("CloudSyncDeferredActions", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
	});
	afterEach(() => ctx.close());

	const log = (cardId: string, updatedAt: number) => ({
		entityType: "review_log" as const,
		entityId: `log-${cardId}-${updatedAt}`,
		parentId: cardId,
		updatedAt,
		sourceDeviceId: "device-b",
		payload: { id: `log-${cardId}-${updatedAt}`, cardId, updatedAt },
	});

	it("knows which parents exist, including soft-deleted ones", () => {
		ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
		ctx.db.run(`UPDATE cards SET deleted_at = ? WHERE id = ?`, [1, "card-1"]);

		expect(ctx.cloudSyncDeferred.isParentPresent("review_log", "card-1")).toBe(
			true,
		);
		expect(ctx.cloudSyncDeferred.isParentPresent("review_log", "ghost")).toBe(
			false,
		);
		expect(
			ctx.cloudSyncDeferred.isParentPresent("note", BUILTIN_BASIC_ID),
		).toBe(true);
		expect(ctx.cloudSyncDeferred.isParentPresent("card", "no-such-note")).toBe(
			false,
		);
	});

	it("parks a row until its parent arrives", () => {
		ctx.cloudSyncDeferred.defer(log("card-later", 100));

		expect(ctx.cloudSyncDeferred.count()).toBe(1);
		expect(ctx.cloudSyncDeferred.takeReady("review_log")).toEqual([]);

		ctx.cards.set("card-later", createTestCard({ id: "card-later" }));

		const ready = ctx.cloudSyncDeferred.takeReady("review_log");
		expect(ready.map((row) => row.entityId)).toEqual(["log-card-later-100"]);
		expect(ready[0]?.payload).toEqual({
			id: "log-card-later-100",
			cardId: "card-later",
			updatedAt: 100,
		});
		expect(ready[0]?.sourceDeviceId).toBe("device-b");
	});

	it("keeps the newest version of a parked row", () => {
		const first = log("card-x", 100);
		ctx.cloudSyncDeferred.defer(first);
		ctx.cloudSyncDeferred.defer({
			...first,
			updatedAt: 200,
			payload: { ...first.payload, updatedAt: 200, rating: 4 },
		});
		ctx.cloudSyncDeferred.defer({
			...first,
			updatedAt: 50,
			payload: { ...first.payload, updatedAt: 50, rating: 1 },
		});
		ctx.cards.set("card-x", createTestCard({ id: "card-x" }));

		const ready = ctx.cloudSyncDeferred.takeReady("review_log");
		expect(ready).toHaveLength(1);
		expect(ready[0]?.updatedAt).toBe(200);
		expect(ready[0]?.payload.rating).toBe(4);
	});

	it("removes rows and reports the remaining count", () => {
		ctx.cloudSyncDeferred.defer(log("a", 1));
		ctx.cloudSyncDeferred.defer(log("b", 2));

		ctx.cloudSyncDeferred.remove("review_log", "log-a-1");

		expect(ctx.cloudSyncDeferred.count()).toBe(1);
		ctx.cards.set("b", createTestCard({ id: "b" }));
		expect(
			ctx.cloudSyncDeferred.takeReady("review_log").map((r) => r.entityId),
		).toEqual(["log-b-2"]);
	});
});
