/**
 * Daily Stats Rebuild Tests
 * The rebuild must attribute reviews to the same day keys the live path
 * uses (local time + dayStartHour), not UTC calendar days.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { formatLocalDate, getTodayBoundary } from "../../../src/utils";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "./__setup__/test-database";

/** ISO timestamp for a wall-clock local time on 2026-02-01. */
function localIso(hour: number): string {
	return new Date(2026, 1, 1, hour, 0, 0).toISOString();
}

function insertLog(
	ctx: TestContext,
	overrides: {
		id: string;
		cardId: string;
		reviewedAt: string;
		rating?: number;
		state?: number;
		timeSpentMs?: number;
		reviewKind?: string | null;
		deletedAt?: number | null;
	},
): void {
	ctx.db.run(
		`INSERT INTO review_log (
			id, card_id, reviewed_at, rating, scheduled_days, elapsed_days,
			state, time_spent_ms, updated_at, deleted_at, preset_name,
			device_id, review_kind
		) VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, ?, NULL, NULL, ?)`,
		[
			overrides.id,
			overrides.cardId,
			overrides.reviewedAt,
			overrides.rating ?? 3,
			overrides.state ?? 2,
			overrides.timeSpentMs ?? 1000,
			Date.now(),
			overrides.deletedAt ?? null,
			overrides.reviewKind ?? "review",
		],
	);
}

describe("rebuildDailyStatsFromReviewLog", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		ctx = await createTestContext();
		const card = createTestCard({ id: "card-1" });
		ctx.cards.set(card.id, card);
	});

	afterEach(() => {
		ctx.close();
	});

	it("attributes an early-morning review to the previous day key (dayStartHour)", () => {
		// 02:00 local with dayStartHour 4 still belongs to Jan 31
		insertLog(ctx, {
			id: "log-early",
			cardId: "card-1",
			reviewedAt: localIso(2),
		});
		// 10:00 local belongs to Feb 1
		insertLog(ctx, {
			id: "log-day",
			cardId: "card-1",
			reviewedAt: localIso(10),
		});

		ctx.stats.rebuildDailyStatsFromReviewLog(4);

		const earlyKey = formatLocalDate(
			getTodayBoundary(4, new Date(2026, 1, 1, 2, 0, 0)),
		);
		const dayKey = formatLocalDate(
			getTodayBoundary(4, new Date(2026, 1, 1, 10, 0, 0)),
		);
		expect(earlyKey).toBe("2026-01-31");
		expect(dayKey).toBe("2026-02-01");

		expect(ctx.stats.getDailyStats(earlyKey)?.reviewsCompleted).toBe(1);
		expect(ctx.stats.getDailyStats(dayKey)?.reviewsCompleted).toBe(1);
	});

	it("excludes preview and tombstoned reviews from rebuilt stats", () => {
		insertLog(ctx, {
			id: "log-real",
			cardId: "card-1",
			reviewedAt: localIso(12),
		});
		insertLog(ctx, {
			id: "log-preview",
			cardId: "card-1",
			reviewedAt: localIso(12),
			reviewKind: "preview",
		});
		insertLog(ctx, {
			id: "log-undone",
			cardId: "card-1",
			reviewedAt: localIso(12),
			deletedAt: Date.now(),
		});

		ctx.stats.rebuildDailyStatsFromReviewLog(4);

		const key = formatLocalDate(
			getTodayBoundary(4, new Date(2026, 1, 1, 12, 0, 0)),
		);
		expect(ctx.stats.getDailyStats(key)?.reviewsCompleted).toBe(1);
	});

	it("rebuilds rating and state breakdowns plus reviewed card ids", () => {
		insertLog(ctx, {
			id: "log-a",
			cardId: "card-1",
			reviewedAt: localIso(12),
			rating: 1,
			state: 0,
			timeSpentMs: 700,
		});
		insertLog(ctx, {
			id: "log-b",
			cardId: "card-1",
			reviewedAt: localIso(13),
			rating: 4,
			state: 2,
			timeSpentMs: 300,
		});

		ctx.stats.rebuildDailyStatsFromReviewLog(4);

		const key = formatLocalDate(
			getTodayBoundary(4, new Date(2026, 1, 1, 12, 0, 0)),
		);
		const stats = ctx.stats.getDailyStats(key);
		expect(stats?.reviewsCompleted).toBe(2);
		expect(stats?.again).toBe(1);
		expect(stats?.easy).toBe(1);
		expect(stats?.newCards).toBe(1);
		expect(stats?.reviewCards).toBe(1);
		expect(stats?.newCardsStudied).toBe(1);
		expect(stats?.totalTimeMs).toBe(1000);
		expect(ctx.stats.getReviewedCardIds(key)).toEqual(["card-1"]);
	});
});
