import type { ExtendedDailyStats } from "../../../../types";
import type { SqliteDatabase } from "../../SqliteDatabase";
import { sqlPlaceholders } from "../../sql-utils";
import { toUtcIsoDayRange } from "./date-utils";

export class DailyProgressQueryActions {
	constructor(private db: SqliteDatabase) {}

	getAllDailyStats(): Record<string, ExtendedDailyStats> {
		const rows = this.db.query<{
			date: string;
			reviewsCompleted: number;
			newCardsStudied: number;
			totalTimeMs: number;
			again: number;
			hard: number;
			good: number;
			easy: number;
			newCards: number;
			learningCards: number;
			reviewCards: number;
			reviewed_card_ids: string | null;
		}>(`
            SELECT
                ds.date,
                ds.reviews_completed as reviewsCompleted,
                ds.new_cards_studied as newCardsStudied,
                ds.total_time_ms as totalTimeMs,
                ds.again_count as again,
                ds.hard_count as hard,
                ds.good_count as good,
                ds.easy_count as easy,
                ds.new_cards as newCards,
                ds.learning_cards as learningCards,
                ds.review_cards as reviewCards,
                GROUP_CONCAT(drc.card_id) as reviewed_card_ids
            FROM daily_stats ds
            LEFT JOIN daily_reviewed_cards drc ON ds.date = drc.date
            GROUP BY ds.date
            ORDER BY ds.date
        `);

		const stats: Record<string, ExtendedDailyStats> = {};
		for (const row of rows) {
			stats[row.date] = {
				date: row.date,
				reviewsCompleted: row.reviewsCompleted,
				newCardsStudied: row.newCardsStudied,
				totalTimeMs: row.totalTimeMs,
				again: row.again,
				hard: row.hard,
				good: row.good,
				easy: row.easy,
				newCards: row.newCards,
				learningCards: row.learningCards,
				reviewCards: row.reviewCards,
				reviewedCardIds: row.reviewed_card_ids
					? row.reviewed_card_ids.split(",")
					: [],
			};
		}

		return stats;
	}

	getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
		const rows = this.db.query<{
			date: string;
			reviewsCompleted: number;
			newCardsStudied: number;
			totalTimeMs: number;
			again: number;
			hard: number;
			good: number;
			easy: number;
			newCards: number;
			learningCards: number;
			reviewCards: number;
		}>(`
            SELECT
                date,
                reviews_completed as reviewsCompleted,
                new_cards_studied as newCardsStudied,
                total_time_ms as totalTimeMs,
                again_count as again,
                hard_count as hard,
                good_count as good,
                easy_count as easy,
                new_cards as newCards,
                learning_cards as learningCards,
                review_cards as reviewCards
            FROM daily_stats
            ORDER BY date
        `);

		const stats: Record<string, ExtendedDailyStats> = {};
		for (const row of rows) {
			stats[row.date] = {
				date: row.date,
				reviewsCompleted: row.reviewsCompleted,
				newCardsStudied: row.newCardsStudied,
				totalTimeMs: row.totalTimeMs,
				again: row.again,
				hard: row.hard,
				good: row.good,
				easy: row.easy,
				newCards: row.newCards,
				learningCards: row.learningCards,
				reviewCards: row.reviewCards,
				reviewedCardIds: [],
			};
		}

		return stats;
	}

	getDailyStatsFromReviewLog(
		startDate: string,
		endDate: string,
		opts?: { presetNames?: string[]; excludeSourceUids?: string[] },
	): ExtendedDailyStats[] {
		const excludeUids = opts?.excludeSourceUids ?? [];
		const presetNames = opts?.presetNames ?? null;
		const { startIso, endExclusiveIso } = toUtcIsoDayRange(startDate, endDate);

		let excludeClause = "";
		const params: (string | number | null)[] = [];

		if (excludeUids.length > 0) {
			excludeClause = `AND c.source_uid NOT IN (${sqlPlaceholders(excludeUids.length)})`;
			params.push(...excludeUids);
		}

		let presetClause = "";
		if (presetNames !== null && presetNames.length > 0) {
			presetClause = `AND COALESCE(r.preset_name, 'Default') IN (${sqlPlaceholders(presetNames.length)})`;
			params.push(...presetNames);
		}

		params.push(startIso, endExclusiveIso);

		const rows = this.db.query<{
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
				substr(r.reviewed_at, 1, 10) as date,
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
				AND r.reviewed_at >= ?
				AND r.reviewed_at < ?
			GROUP BY substr(r.reviewed_at, 1, 10)
			ORDER BY date
		`,
			params,
		);

		return rows.map(
			(row: {
				date: string;
				reviewsCompleted: number;
				newCardsStudied: number;
				totalTimeMs: number;
				again: number;
				hard: number;
				good: number;
				easy: number;
				reviewCards: number;
			}) => ({
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
			}),
		);
	}
}
