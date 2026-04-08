import type { ExtendedDailyStats } from "../../../../types";
import type { SqliteDatabase } from "../../SqliteDatabase";
import { sqlPlaceholders } from "../../sql-utils";
import { toUtcIsoDayRange } from "./date-utils";

export class DailyProgressActions {
	constructor(private db: SqliteDatabase) {}

	getDailyStats(date: string): ExtendedDailyStats | null {
		const row = this.db.get<{
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
		}>(
			`
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
            WHERE ds.date = ?
            GROUP BY ds.date
        `,
			[date],
		);

		if (!row) return null;

		return {
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

	updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
		this.db.run(
			`
            INSERT INTO daily_stats (
                date, reviews_completed, new_cards_studied, total_time_ms,
                again_count, hard_count, good_count, easy_count,
                new_cards, learning_cards, review_cards
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                reviews_completed = reviews_completed + excluded.reviews_completed,
                new_cards_studied = new_cards_studied + excluded.new_cards_studied,
                total_time_ms = total_time_ms + excluded.total_time_ms,
                again_count = again_count + excluded.again_count,
                hard_count = hard_count + excluded.hard_count,
                good_count = good_count + excluded.good_count,
                easy_count = easy_count + excluded.easy_count,
                new_cards = new_cards + excluded.new_cards,
                learning_cards = learning_cards + excluded.learning_cards,
                review_cards = review_cards + excluded.review_cards
        `,
			[
				date,
				stats.reviewsCompleted || 0,
				stats.newCardsStudied || 0,
				stats.totalTimeMs || 0,
				stats.again || 0,
				stats.hard || 0,
				stats.good || 0,
				stats.easy || 0,
				stats.newCards || 0,
				stats.learningCards || 0,
				stats.reviewCards || 0,
			],
		);
	}

	decrementDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
		this.db.run(
			`
            UPDATE daily_stats SET
                reviews_completed = MAX(0, reviews_completed - ?),
                new_cards_studied = MAX(0, new_cards_studied - ?),
                total_time_ms = MAX(0, total_time_ms - ?),
                again_count = MAX(0, again_count - ?),
                hard_count = MAX(0, hard_count - ?),
                good_count = MAX(0, good_count - ?),
                easy_count = MAX(0, easy_count - ?),
                new_cards = MAX(0, new_cards - ?),
                learning_cards = MAX(0, learning_cards - ?),
                review_cards = MAX(0, review_cards - ?)
            WHERE date = ?
        `,
			[
				stats.reviewsCompleted || 0,
				stats.newCardsStudied || 0,
				stats.totalTimeMs || 0,
				stats.again || 0,
				stats.hard || 0,
				stats.good || 0,
				stats.easy || 0,
				stats.newCards || 0,
				stats.learningCards || 0,
				stats.reviewCards || 0,
				date,
			],
		);
	}

	recordReviewedCard(date: string, cardId: string): void {
		this.db.run(
			`
            INSERT OR IGNORE INTO daily_reviewed_cards (date, card_id)
            VALUES (?, ?)
        `,
			[date, cardId],
		);
	}

	getReviewedCardIds(date: string): string[] {
		const rows = this.db.query<{ card_id: string }>(
			`SELECT card_id FROM daily_reviewed_cards WHERE date = ?`,
			[date],
		);
		return rows.map((r: { card_id: string }) => r.card_id);
	}

	removeReviewedCard(date: string, cardId: string): void {
		this.db.run(
			`
            DELETE FROM daily_reviewed_cards
            WHERE date = ? AND card_id = ?
        `,
			[date, cardId],
		);
	}

	rebuildDailyStatsFromReviewLog(): void {
		this.db.transaction(() => {
			this.db.run(`DELETE FROM daily_stats`);
			this.db.run(`DELETE FROM daily_reviewed_cards`);

			this.db.run(`
                INSERT INTO daily_stats (
                    date, reviews_completed, new_cards_studied, total_time_ms,
                    again_count, hard_count, good_count, easy_count,
                    new_cards, learning_cards, review_cards
                )
                SELECT
                    date(reviewed_at) as date,
                    COUNT(*) as reviews_completed,
                    SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new_cards_studied,
                    COALESCE(SUM(time_spent_ms), 0) as total_time_ms,
                    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as again_count,
                    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as hard_count,
                    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as good_count,
                    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as easy_count,
                    SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new_cards,
                    SUM(CASE WHEN state IN (1, 3) THEN 1 ELSE 0 END) as learning_cards,
                    SUM(CASE WHEN state = 2 THEN 1 ELSE 0 END) as review_cards
                FROM review_log
                WHERE deleted_at IS NULL
                  AND reviewed_at IS NOT NULL
                  AND date(reviewed_at) IS NOT NULL
                GROUP BY date(reviewed_at)
            `);

			this.db.run(`
                INSERT INTO daily_reviewed_cards (date, card_id)
                SELECT DISTINCT date(reviewed_at), card_id
                FROM review_log
                WHERE deleted_at IS NULL
                  AND reviewed_at IS NOT NULL
                  AND date(reviewed_at) IS NOT NULL
            `);
		});
	}

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
