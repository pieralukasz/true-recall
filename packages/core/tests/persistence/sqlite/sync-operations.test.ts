/**
 * Sync Operations Tests
 * Behavior-first tests for multi-device sync functionality
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "./__setup__/test-database";

describe("Sync Operations", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
		ctx = await createTestContext();
	});

	afterEach(() => {
		ctx.close();
		vi.useRealTimers();
	});

	describe("Card Sync - getModifiedSince", () => {
		it("should return cards modified after timestamp", async () => {
			// Create card at time T1
			const card1 = createTestCard({ id: "card-1" });
			ctx.cards.set(card1.id, card1);

			// Advance time
			vi.advanceTimersByTime(1000);
			const timestamp = Date.now();

			// Create card at time T2
			vi.advanceTimersByTime(1000);
			const card2 = createTestCard({ id: "card-2" });
			ctx.cards.set(card2.id, card2);

			const modified = ctx.cards.getModifiedSince(timestamp);

			expect(modified).toHaveLength(1);
			expect(modified[0]?.id).toBe("card-2");
		});

		it("should include soft-deleted cards in modified results", async () => {
			const card = createTestCard({ id: "card-deleted" });
			ctx.cards.set(card.id, card);

			vi.advanceTimersByTime(1000);
			const timestamp = Date.now();

			// Soft delete after timestamp
			vi.advanceTimersByTime(1000);
			ctx.cards.softDelete(card.id);

			const modified = ctx.cards.getModifiedSince(timestamp);

			expect(modified).toHaveLength(1);
			expect(modified[0]?.id).toBe("card-deleted");
			expect(modified[0]?.deletedAt).toBeDefined();
		});

		it("should return empty array when no modifications after timestamp", async () => {
			const card = createTestCard({ id: "card-old" });
			ctx.cards.set(card.id, card);

			vi.advanceTimersByTime(5000);
			const futureTimestamp = Date.now();

			const modified = ctx.cards.getModifiedSince(futureTimestamp);

			expect(modified).toHaveLength(0);
		});

		it("should include updatedAt in results", async () => {
			const card = createTestCard({ id: "card-with-time" });
			ctx.cards.set(card.id, card);

			const modified = ctx.cards.getModifiedSince(0);

			expect(modified).toHaveLength(1);
			expect(modified[0]?.updatedAt).toBeDefined();
			expect(typeof modified[0]?.updatedAt).toBe("number");
		});
	});

	describe("Card Sync - upsertFromRemote", () => {
		it("should insert new card from remote", async () => {
			const remoteCard = {
				id: "remote-card-1",
				due: new Date().toISOString(),
				stability: 5,
				difficulty: 5,
				reps: 3,
				lapses: 0,
				state: State.Review,
				lastReview: new Date().toISOString(),
				scheduledDays: 7,
				learningStep: 0,
				suspended: false,
				question: "Remote question",
				answer: "Remote answer",
				updatedAt: Date.now(),
				deletedAt: null,
			};

			ctx.cards.upsertFromRemote(remoteCard);

			const stored = ctx.cards.get("remote-card-1");
			expect(stored).toBeDefined();
			expect(stored?.question).toBe("Remote question");
			expect(stored?.stability).toBe(5);
		});

		it("should update existing card from remote (LWW)", async () => {
			// Create local card
			const localCard = createTestCard({
				id: "card-lww",
				question: "Local question",
			});
			ctx.cards.set(localCard.id, localCard);

			// Simulate remote update with newer timestamp
			vi.advanceTimersByTime(5000);
			const remoteUpdate = {
				...localCard,
				question: "Remote updated question",
				updatedAt: Date.now(),
				deletedAt: null,
			};

			ctx.cards.upsertFromRemote(remoteUpdate);

			const stored = ctx.cards.get("card-lww");
			expect(stored?.question).toBe("Remote updated question");
		});

		it("should preserve remote timestamps", async () => {
			const remoteTimestamp = Date.now() - 10000; // 10 seconds ago
			const remoteCard = {
				id: "remote-timestamps",
				due: new Date().toISOString(),
				stability: 5,
				difficulty: 5,
				reps: 3,
				lapses: 0,
				state: State.Review,
				lastReview: null,
				scheduledDays: 7,
				learningStep: 0,
				suspended: false,
				question: "Q",
				answer: "A",
				createdAt: remoteTimestamp - 1000,
				updatedAt: remoteTimestamp,
				deletedAt: null,
			};

			ctx.cards.upsertFromRemote(remoteCard);

			const modified = ctx.cards.getModifiedSince(0);
			const card = modified.find((c) => c.id === "remote-timestamps");
			expect(card?.updatedAt).toBe(remoteTimestamp);
		});

		it("should handle soft-deleted cards from remote", async () => {
			const deletedCard = {
				id: "remote-deleted",
				due: new Date().toISOString(),
				stability: 5,
				difficulty: 5,
				reps: 3,
				lapses: 0,
				state: State.Review,
				lastReview: null,
				scheduledDays: 7,
				learningStep: 0,
				suspended: false,
				question: "Deleted Q",
				answer: "Deleted A",
				updatedAt: Date.now(),
				deletedAt: Date.now(),
			};

			ctx.cards.upsertFromRemote(deletedCard);

			// Should not appear in normal get (excludes deleted)
			const stored = ctx.cards.get("remote-deleted");
			expect(stored).toBeUndefined();

			// Should appear in getAllIncludingDeleted
			const all = ctx.cards.getAllIncludingDeleted();
			const found = all.find((c) => c.id === "remote-deleted");
			expect(found).toBeDefined();
		});
	});

	describe("Card Sync - getAllIncludingDeleted", () => {
		it("should include soft-deleted cards", async () => {
			const card1 = createTestCard({ id: "active-card" });
			const card2 = createTestCard({ id: "deleted-card" });

			ctx.cards.set(card1.id, card1);
			ctx.cards.set(card2.id, card2);
			ctx.cards.softDelete("deleted-card");

			const all = ctx.cards.getAllIncludingDeleted();

			expect(all).toHaveLength(2);
			expect(all.map((c) => c.id)).toContain("active-card");
			expect(all.map((c) => c.id)).toContain("deleted-card");
		});

		it("should return empty array when no cards exist", async () => {
			const all = ctx.cards.getAllIncludingDeleted();
			expect(all).toHaveLength(0);
		});
	});

	describe("Card Sync - deleteAllForSync", () => {
		it("should remove all cards", async () => {
			ctx.cards.set("card-1", createTestCard({ id: "card-1" }));
			ctx.cards.set("card-2", createTestCard({ id: "card-2" }));
			ctx.cards.set("card-3", createTestCard({ id: "card-3" }));

			expect(ctx.cards.size()).toBe(3);

			ctx.cards.deleteAllForSync();

			expect(ctx.cards.size()).toBe(0);
			expect(ctx.cards.getAllIncludingDeleted()).toHaveLength(0);
		});
	});

	describe("Sync Metadata", () => {
		it("should return null for missing key", async () => {
			const value = ctx.cards.getSyncMetadata("nonexistent");
			expect(value).toBeNull();
		});

		it("should create new metadata entry", async () => {
			ctx.cards.setSyncMetadata("lastSync", "2026-02-01T10:00:00Z");

			const value = ctx.cards.getSyncMetadata("lastSync");
			expect(value).toBe("2026-02-01T10:00:00Z");
		});

		it("should update existing metadata entry", async () => {
			ctx.cards.setSyncMetadata("lastSync", "2026-02-01T10:00:00Z");
			ctx.cards.setSyncMetadata("lastSync", "2026-02-02T15:30:00Z");

			const value = ctx.cards.getSyncMetadata("lastSync");
			expect(value).toBe("2026-02-02T15:30:00Z");
		});

		it("should handle multiple metadata keys", async () => {
			ctx.cards.setSyncMetadata("lastSync", "2026-02-01");
			ctx.cards.setSyncMetadata("deviceId", "device-123");
			ctx.cards.setSyncMetadata("syncVersion", "2");

			expect(ctx.cards.getSyncMetadata("lastSync")).toBe("2026-02-01");
			expect(ctx.cards.getSyncMetadata("deviceId")).toBe("device-123");
			expect(ctx.cards.getSyncMetadata("syncVersion")).toBe("2");
		});
	});

	describe("Review Log Sync - getModifiedReviewLogSince", () => {
		it("should return review logs modified after timestamp", async () => {
			// Add review log entries at different times
			ctx.stats.addReviewLog("card-1", 3, 7, 0, State.Review, 5000);

			vi.advanceTimersByTime(1000);
			const timestamp = Date.now();

			vi.advanceTimersByTime(1000);
			ctx.stats.addReviewLog("card-2", 4, 14, 7, State.Review, 3000);

			const modified = ctx.stats.getModifiedReviewLogSince(timestamp);

			expect(modified).toHaveLength(1);
			expect(modified[0]?.cardId).toBe("card-2");
		});

		it("should include deleted review logs in modified results", async () => {
			// Create card first
			const card = createTestCard({ id: "card-with-log" });
			ctx.cards.set(card.id, card);

			ctx.stats.addReviewLog("card-with-log", 3, 7, 0, State.Review, 5000);

			vi.advanceTimersByTime(1000);
			const timestamp = Date.now();

			// Soft delete card with cascade
			vi.advanceTimersByTime(1000);
			ctx.cards.softDeleteWithCascade("card-with-log");

			const modified = ctx.stats.getModifiedReviewLogSince(timestamp);

			// Should include the deleted review log
			expect(modified.length).toBeGreaterThanOrEqual(1);
			const deletedLog = modified.find((l) => l.cardId === "card-with-log");
			expect(deletedLog?.deletedAt).toBeDefined();
		});
	});

	describe("Review Log Sync - upsertReviewLogFromRemote", () => {
		it("should insert new review log from remote", async () => {
			const remoteLog = {
				id: "remote-log-1",
				cardId: "card-1",
				reviewedAt: new Date().toISOString(),
				rating: 3,
				scheduledDays: 7,
				elapsedDays: 0,
				state: State.Review,
				timeSpentMs: 5000,
				updatedAt: Date.now(),
				deletedAt: null,
				presetName: null,
			};

			ctx.stats.upsertReviewLogFromRemote(remoteLog);

			const stored = ctx.stats.getReviewLogForSync("remote-log-1");
			expect(stored).toBeDefined();
			expect(stored?.cardId).toBe("card-1");
			expect(stored?.rating).toBe(3);
		});

		it("should update existing review log from remote", async () => {
			const initialLog = {
				id: "log-update",
				cardId: "card-1",
				reviewedAt: new Date().toISOString(),
				rating: 2,
				scheduledDays: 3,
				elapsedDays: 0,
				state: State.Learning,
				timeSpentMs: 3000,
				updatedAt: Date.now(),
				deletedAt: null,
				presetName: null,
			};

			ctx.stats.upsertReviewLogFromRemote(initialLog);

			// Update with higher rating
			vi.advanceTimersByTime(1000);
			const updatedLog = {
				...initialLog,
				rating: 4,
				scheduledDays: 14,
				updatedAt: Date.now(),
			};

			ctx.stats.upsertReviewLogFromRemote(updatedLog);

			const stored = ctx.stats.getReviewLogForSync("log-update");
			expect(stored?.rating).toBe(4);
			expect(stored?.scheduledDays).toBe(14);
		});
	});

	describe("Review Log Sync - deleteAllReviewLogForSync", () => {
		it("should remove all review logs", async () => {
			ctx.stats.addReviewLog("card-1", 3, 7, 0, State.Review, 5000);
			ctx.stats.addReviewLog("card-2", 4, 14, 7, State.Review, 3000);
			ctx.stats.addReviewLog("card-3", 2, 1, 0, State.Learning, 2000);

			expect(ctx.stats.getTotalReviewCount()).toBe(3);

			ctx.stats.deleteAllReviewLogForSync();

			expect(ctx.stats.getTotalReviewCount()).toBe(0);
		});
	});

	describe("Data Integrity During Sync", () => {
		it("should maintain timestamp consistency on updates", async () => {
			const card = createTestCard({ id: "timestamp-test" });
			ctx.cards.set(card.id, card);

			const initialModified = ctx.cards.getModifiedSince(0);
			const initialTimestamp = initialModified[0]?.updatedAt;
			if (initialTimestamp === undefined) {
				throw new Error("expected seed card to have updatedAt");
			}

			// Wait and update
			vi.advanceTimersByTime(5000);
			const updatedCard = { ...card, question: "Updated question" };
			ctx.cards.set(card.id, updatedCard);

			const afterModified = ctx.cards.getModifiedSince(0);
			const afterTimestamp = afterModified[0]?.updatedAt;

			expect(afterTimestamp).toBeGreaterThan(initialTimestamp);
		});

		it("should cascade soft delete to review_log", async () => {
			const card = createTestCard({ id: "cascade-test" });
			ctx.cards.set(card.id, card);
			ctx.stats.addReviewLog("cascade-test", 3, 7, 0, State.Review, 5000);

			vi.advanceTimersByTime(1000);
			const timestamp = Date.now();

			vi.advanceTimersByTime(1000);
			ctx.cards.softDeleteWithCascade("cascade-test");

			// Both card and review log should be in modified
			const modifiedCards = ctx.cards.getModifiedSince(timestamp);
			const modifiedLogs = ctx.stats.getModifiedReviewLogSince(timestamp);

			expect(modifiedCards.some((c) => c.id === "cascade-test")).toBe(true);
			expect(modifiedLogs.some((l) => l.cardId === "cascade-test")).toBe(true);
		});
	});

	describe("LWW conflict resolution", () => {
		it("upsertFromRemote returns false when local card has newer updated_at", async () => {
			vi.setSystemTime(new Date(2000));
			const card = createTestCard({ id: "lww-newer-local" });
			ctx.cards.set(card.id, card);

			const result = ctx.cards.upsertFromRemote({
				id: "lww-newer-local",
				due: new Date().toISOString(),
				stability: 99,
				difficulty: 99,
				reps: 10,
				lapses: 5,
				state: State.Review,
				lastReview: new Date().toISOString(),
				scheduledDays: 30,
				learningStep: 0,
				suspended: false,
				question: "Remote question",
				answer: "Remote answer",
				updatedAt: 1000,
				deletedAt: null,
			});

			expect(result).toBe(false);

			const stored = ctx.cards.get("lww-newer-local");
			expect(stored?.question).toBe("Question for lww-newer-local");
			expect(stored?.stability).toBe(0);
		});

		it("upsertFromRemote returns false when timestamps are equal", async () => {
			vi.setSystemTime(new Date(1000));
			const card = createTestCard({ id: "lww-equal" });
			ctx.cards.set(card.id, card);

			const result = ctx.cards.upsertFromRemote({
				id: "lww-equal",
				due: new Date().toISOString(),
				stability: 99,
				difficulty: 99,
				reps: 10,
				lapses: 5,
				state: State.Review,
				lastReview: new Date().toISOString(),
				scheduledDays: 30,
				learningStep: 0,
				suspended: false,
				question: "Remote question",
				answer: "Remote answer",
				updatedAt: 1000,
				deletedAt: null,
			});

			expect(result).toBe(false);

			const stored = ctx.cards.get("lww-equal");
			expect(stored?.question).toBe("Question for lww-equal");
		});

		it("upsertFromRemote returns false when remote updatedAt is undefined", async () => {
			vi.setSystemTime(new Date(1000));
			const card = createTestCard({ id: "lww-undefined" });
			ctx.cards.set(card.id, card);

			const result = ctx.cards.upsertFromRemote({
				id: "lww-undefined",
				due: new Date().toISOString(),
				stability: 99,
				difficulty: 99,
				reps: 10,
				lapses: 5,
				state: State.Review,
				lastReview: new Date().toISOString(),
				scheduledDays: 30,
				learningStep: 0,
				suspended: false,
				question: "Remote question",
				answer: "Remote answer",
				updatedAt: undefined,
				deletedAt: null,
			});

			expect(result).toBe(false);

			const stored = ctx.cards.get("lww-undefined");
			expect(stored?.question).toBe("Question for lww-undefined");
		});

		it("upsertReviewLogFromRemote returns false when local log has newer updated_at", async () => {
			const newerTimestamp = 2000;
			const olderTimestamp = 1000;

			const initialLog = {
				id: "lww-log-newer",
				cardId: "card-1",
				reviewedAt: new Date().toISOString(),
				rating: 3,
				scheduledDays: 7,
				elapsedDays: 0,
				state: State.Review,
				timeSpentMs: 5000,
				updatedAt: newerTimestamp,
				deletedAt: null,
				presetName: null,
			};

			ctx.stats.upsertReviewLogFromRemote(initialLog);

			const result = ctx.stats.upsertReviewLogFromRemote({
				...initialLog,
				rating: 1,
				updatedAt: olderTimestamp,
			});

			expect(result).toBe(false);

			const stored = ctx.stats.getReviewLogForSync("lww-log-newer");
			expect(stored?.rating).toBe(3);
		});

		it("upsertReviewLogFromRemote returns false when timestamps are equal", async () => {
			const timestamp = 1000;

			const initialLog = {
				id: "lww-log-equal",
				cardId: "card-1",
				reviewedAt: new Date().toISOString(),
				rating: 3,
				scheduledDays: 7,
				elapsedDays: 0,
				state: State.Review,
				timeSpentMs: 5000,
				updatedAt: timestamp,
				deletedAt: null,
				presetName: null,
			};

			ctx.stats.upsertReviewLogFromRemote(initialLog);

			const result = ctx.stats.upsertReviewLogFromRemote({
				...initialLog,
				rating: 1,
				updatedAt: timestamp,
			});

			expect(result).toBe(false);

			const stored = ctx.stats.getReviewLogForSync("lww-log-equal");
			expect(stored?.rating).toBe(3);
		});
	});
});
