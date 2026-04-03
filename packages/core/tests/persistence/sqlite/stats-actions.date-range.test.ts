import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const hasSqlJs = (() => {
	try {
		require.resolve("sql.js");
		return true;
	} catch {
		return false;
	}
})();

type TestDatabaseModule = typeof import("./__setup__/test-database");
let dbModule: TestDatabaseModule | null = null;
type TestContext = Awaited<ReturnType<TestDatabaseModule["createTestContext"]>>;

function addReviewAt(
	ctx: TestContext,
	atIso: string,
	cardId: string,
	rating: number,
	state: number,
	presetName?: string,
): void {
	vi.setSystemTime(new Date(atIso));
	ctx.stats.addReviewLog(cardId, rating, 7, 0, state, 1200, presetName);
}

function softDeleteLastReview(ctx: TestContext): void {
	const last = ctx.db.get<{ id: string }>(
		`SELECT id FROM review_log ORDER BY rowid DESC LIMIT 1`,
	);
	if (!last) return;
	ctx.db.run(`UPDATE review_log SET deleted_at = ? WHERE id = ?`, [
		Date.now(),
		last.id,
	]);
}

function legacyReviewsForRetention(
	ctx: TestContext,
	startDate: string,
	endDate: string,
	presetNames?: string[],
): { date: string; rating: number }[] {
	let presetClause = "";
	const params: (string | number | null)[] = [];

	if (presetNames && presetNames.length > 0) {
		const placeholders = presetNames.map(() => "?").join(",");
		presetClause = `AND COALESCE(r.preset_name, 'Default') IN (${placeholders})`;
		params.push(...presetNames);
	}

	params.push(startDate, endDate);

	return ctx.db.query<{ date: string; rating: number }>(
		`
		SELECT
			date(r.reviewed_at) as date,
			r.rating
		FROM review_log r
		JOIN cards c ON r.card_id = c.id
		WHERE r.deleted_at IS NULL
		  AND c.deleted_at IS NULL
		  AND r.state = 2
		  ${presetClause}
		  AND date(r.reviewed_at) BETWEEN ? AND ?
	`,
		params,
	);
}

function legacyDailyStatsFromReviewLog(
	ctx: TestContext,
	startDate: string,
	endDate: string,
	opts?: { presetNames?: string[]; excludeSourceUids?: string[] },
) {
	const excludeUids = opts?.excludeSourceUids ?? [];
	const presetNames = opts?.presetNames ?? null;

	let excludeClause = "";
	const params: (string | number | null)[] = [];

	if (excludeUids.length > 0) {
		excludeClause = `AND c.source_uid NOT IN (${excludeUids.map(() => "?").join(",")})`;
		params.push(...excludeUids);
	}

	let presetClause = "";
	if (presetNames !== null && presetNames.length > 0) {
		const placeholders = presetNames.map(() => "?").join(",");
		presetClause = `AND COALESCE(r.preset_name, 'Default') IN (${placeholders})`;
		params.push(...presetNames);
	}

	params.push(startDate, endDate);

	const rows = ctx.db.query<{
		date: string;
		reviewsCompleted: number;
		newCardsStudied: number;
		totalTimeMs: number;
		again: number;
		hard: number;
		good: number;
		easy: number;
		reviewCards: number;
	}>(
		`
		SELECT
			date(r.reviewed_at) as date,
			COUNT(*) as reviewsCompleted,
			SUM(CASE WHEN r.state = 0 THEN 1 ELSE 0 END) as newCardsStudied,
			COALESCE(SUM(r.time_spent_ms), 0) as totalTimeMs,
			SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) as again,
			SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) as hard,
			SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) as good,
			SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) as easy,
			SUM(CASE WHEN r.state = 2 THEN 1 ELSE 0 END) as reviewCards
		FROM review_log r
		JOIN cards c ON r.card_id = c.id
		WHERE r.deleted_at IS NULL AND c.deleted_at IS NULL
			${excludeClause}
			${presetClause}
			AND date(r.reviewed_at) BETWEEN ? AND ?
		GROUP BY date(r.reviewed_at)
		ORDER BY date
	`,
		params,
	);

	return rows.map((row) => ({
		date: row.date,
		reviewsCompleted: row.reviewsCompleted,
		newCardsStudied: row.newCardsStudied,
		totalTimeMs: row.totalTimeMs,
		again: row.again,
		hard: row.hard,
		good: row.good,
		easy: row.easy,
		newCards: 0,
		learningCards: 0,
		reviewCards: row.reviewCards,
		reviewedCardIds: [],
	}));
}

describe("StatsActions date-range SQL compatibility", () => {
	let ctx: TestContext;

	beforeEach(async () => {
		if (!hasSqlJs) return;
		if (!dbModule) {
			dbModule = await import("./__setup__/test-database");
		}

		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
		ctx = await dbModule.createTestContext();

		const cardA = dbModule.createTestCard({ id: "card-a", sourceUid: "uid-a" });
		const cardB = dbModule.createTestCard({ id: "card-b", sourceUid: "uid-b" });
		const cardExcluded = dbModule.createTestCard({
			id: "card-excluded",
			sourceUid: "uid-excluded",
		});
		ctx.cards.set(cardA.id, cardA);
		ctx.cards.set(cardB.id, cardB);
		ctx.cards.set(cardExcluded.id, cardExcluded);

		addReviewAt(ctx, "2026-03-01T00:00:00.000Z", "card-a", 3, 2, "Default");
		addReviewAt(ctx, "2026-03-01T23:59:59.000Z", "card-a", 4, 2);
		addReviewAt(ctx, "2026-03-02T10:00:00.000Z", "card-a", 3, 2, "Medical");
		softDeleteLastReview(ctx);
		addReviewAt(ctx, "2026-03-02T12:00:00.000Z", "card-a", 2, 2, "Medical");
		addReviewAt(ctx, "2026-03-02T23:59:59.000Z", "card-b", 1, 0, "Medical");
		addReviewAt(
			ctx,
			"2026-03-02T16:00:00.000Z",
			"card-excluded",
			4,
			2,
			"Medical",
		);
		addReviewAt(ctx, "2026-03-03T00:00:00.000Z", "card-a", 4, 2, "Medical");
	});

	afterEach(() => {
		if (!hasSqlJs) return;
		ctx.close();
		vi.useRealTimers();
	});

	it("getReviewsForRetention matches legacy date() semantics", () => {
		if (!hasSqlJs) return;
		const start = "2026-03-01";
		const end = "2026-03-02";
		const presets = ["Default", "Medical"];

		const next = ctx.stats
			.getReviewsForRetention(start, end, presets)
			.sort((a, b) =>
				`${a.date}-${a.rating}`.localeCompare(`${b.date}-${b.rating}`),
			);
		const legacy = legacyReviewsForRetention(ctx, start, end, presets).sort(
			(a, b) => `${a.date}-${a.rating}`.localeCompare(`${b.date}-${b.rating}`),
		);

		expect(next).toEqual(legacy);
	});

	it("getDailyStatsFromReviewLog matches legacy date() semantics", () => {
		if (!hasSqlJs) return;
		const start = "2026-03-01";
		const end = "2026-03-02";
		const opts = {
			presetNames: ["Default", "Medical"],
			excludeSourceUids: ["uid-excluded"],
		};

		const next = ctx.stats.getDailyStatsFromReviewLog(start, end, opts);
		const legacy = legacyDailyStatsFromReviewLog(ctx, start, end, opts);

		expect(next).toEqual(legacy);
	});
});
