import type { ExtendedDailyStats } from "../../../../types";
import { formatLocalDate, getTodayBoundary } from "../../../../utils";
import type { SqliteDatabase } from "../../SqliteDatabase";

interface RebuildAggregate {
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
	cardIds: Set<string>;
}

function createEmptyAggregate(): RebuildAggregate {
	return {
		reviewsCompleted: 0,
		newCardsStudied: 0,
		totalTimeMs: 0,
		again: 0,
		hard: 0,
		good: 0,
		easy: 0,
		newCards: 0,
		learningCards: 0,
		reviewCards: 0,
		cardIds: new Set<string>(),
	};
}

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

	/**
	 * Rebuild daily aggregates from the review log after a device-sync merge.
	 * Day keys are computed in JS with the same local-time + dayStartHour
	 * logic the live path uses (DayBoundaryService.getTodayKey); a plain SQL
	 * date(reviewed_at) would group by UTC days and drift from live stats.
	 * Preview answers never touch daily limits, so they are excluded here too.
	 */
	rebuildDailyStatsFromReviewLog(dayStartHour = 4): void {
		const logs = this.db.query<{
			card_id: string;
			reviewed_at: string;
			rating: number;
			state: number;
			time_spent_ms: number | null;
		}>(`
            SELECT card_id, reviewed_at, rating, state, time_spent_ms
            FROM review_log
            WHERE deleted_at IS NULL
              AND reviewed_at IS NOT NULL
              AND (review_kind IS NULL OR review_kind != 'preview')
        `);

		const byDay = new Map<string, RebuildAggregate>();
		for (const log of logs) {
			const reviewedAt = new Date(log.reviewed_at);
			if (Number.isNaN(reviewedAt.getTime())) continue;
			const dayKey = formatLocalDate(getTodayBoundary(dayStartHour, reviewedAt));

			let agg = byDay.get(dayKey);
			if (!agg) {
				agg = createEmptyAggregate();
				byDay.set(dayKey, agg);
			}

			agg.reviewsCompleted++;
			agg.totalTimeMs += log.time_spent_ms ?? 0;
			if (log.rating === 1) agg.again++;
			if (log.rating === 2) agg.hard++;
			if (log.rating === 3) agg.good++;
			if (log.rating === 4) agg.easy++;
			if (log.state === 0) {
				agg.newCards++;
				agg.newCardsStudied++;
			}
			if (log.state === 1 || log.state === 3) agg.learningCards++;
			if (log.state === 2) agg.reviewCards++;
			agg.cardIds.add(log.card_id);
		}

		this.db.transaction(() => {
			this.db.run(`DELETE FROM daily_stats`);
			this.db.run(`DELETE FROM daily_reviewed_cards`);

			for (const [date, agg] of byDay) {
				this.db.run(
					`INSERT INTO daily_stats (
                        date, reviews_completed, new_cards_studied, total_time_ms,
                        again_count, hard_count, good_count, easy_count,
                        new_cards, learning_cards, review_cards
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						date,
						agg.reviewsCompleted,
						agg.newCardsStudied,
						agg.totalTimeMs,
						agg.again,
						agg.hard,
						agg.good,
						agg.easy,
						agg.newCards,
						agg.learningCards,
						agg.reviewCards,
					],
				);
				for (const cardId of agg.cardIds) {
					this.db.run(
						`INSERT OR IGNORE INTO daily_reviewed_cards (date, card_id) VALUES (?, ?)`,
						[date, cardId],
					);
				}
			}
		});
	}
}
