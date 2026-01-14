/**
 * SQLite Daily Stats Repository
 * Review log and daily statistics operations
 */
import type { Database } from "sql.js";
import type { CardReviewLogEntry, ExtendedDailyStats } from "../../../types";
import { getQueryResult } from "./sqlite.types";

/**
 * Repository for daily stats and review log operations
 */
export class SqliteDailyStatsRepo {
    private db: Database;
    private onDataChange: () => void;

    constructor(db: Database, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    // ===== Review Log =====

    /**
     * Add a review log entry
     */
    addReviewLog(
        cardId: string,
        rating: number,
        scheduledDays: number,
        elapsedDays: number,
        state: number,
        timeSpentMs: number
    ): void {
        this.db.run(`
            INSERT INTO review_log (
                card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms
            ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
        `, [cardId, rating, scheduledDays, elapsedDays, state, timeSpentMs]);

        this.onDataChange();
    }

    /**
     * Get review history for a card
     */
    getCardReviewHistory(cardId: string, limit = 20): CardReviewLogEntry[] {
        const result = this.db.exec(`
            SELECT reviewed_at, rating, scheduled_days, elapsed_days
            FROM review_log
            WHERE card_id = ?
            ORDER BY reviewed_at DESC
            LIMIT ?
        `, [cardId, limit]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => ({
            t: new Date(row[0] as string).getTime(),
            r: row[1] as number,
            s: row[2] as number,
            e: row[3] as number,
        }));
    }

    // ===== Daily Stats =====

    /**
     * Get daily stats for a date
     */
    getDailyStats(date: string): ExtendedDailyStats | null {
        const result = this.db.exec(`
            SELECT * FROM daily_stats WHERE date = ?
        `, [date]);

        const data = getQueryResult(result);
        if (!data) return null;

        const row = data.values[0]!;
        const cols = data.columns;

        // Get reviewed card IDs
        const reviewedCardIds = this.getReviewedCardIds(date);

        return {
            date: row[cols.indexOf("date")] as string,
            reviewsCompleted: row[cols.indexOf("reviews_completed")] as number,
            newCardsStudied: row[cols.indexOf("new_cards_studied")] as number,
            totalTimeMs: row[cols.indexOf("total_time_ms")] as number,
            again: row[cols.indexOf("again_count")] as number,
            hard: row[cols.indexOf("hard_count")] as number,
            good: row[cols.indexOf("good_count")] as number,
            easy: row[cols.indexOf("easy_count")] as number,
            newCards: row[cols.indexOf("new_cards")] as number,
            learningCards: row[cols.indexOf("learning_cards")] as number,
            reviewCards: row[cols.indexOf("review_cards")] as number,
            reviewedCardIds,
        };
    }

    /**
     * Update daily stats (increment counters)
     */
    updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
        this.db.run(`
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
        `, [
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
        ]);

        this.onDataChange();
    }

    /**
     * Decrement daily stats (for undo functionality)
     */
    decrementDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
        this.db.run(`
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
        `, [
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
        ]);

        this.onDataChange();
    }

    /**
     * Record a reviewed card for daily limits
     */
    recordReviewedCard(date: string, cardId: string): void {
        this.db.run(`
            INSERT OR IGNORE INTO daily_reviewed_cards (date, card_id)
            VALUES (?, ?)
        `, [date, cardId]);

        this.onDataChange();
    }

    /**
     * Get all reviewed card IDs for a date
     */
    getReviewedCardIds(date: string): string[] {
        const result = this.db.exec(`
            SELECT card_id FROM daily_reviewed_cards WHERE date = ?
        `, [date]);

        const data = getQueryResult(result);
        if (!data) return [];
        return data.values.map((row) => row[0] as string);
    }

    /**
     * Remove a reviewed card entry (for undo)
     */
    removeReviewedCard(date: string, cardId: string): void {
        this.db.run(`
            DELETE FROM daily_reviewed_cards WHERE date = ? AND card_id = ?
        `, [date, cardId]);

        this.onDataChange();
    }

    /**
     * Get all daily stats
     */
    getAllDailyStats(): Record<string, ExtendedDailyStats> {
        const result = this.db.exec(`SELECT * FROM daily_stats ORDER BY date`);
        const data = getQueryResult(result);
        if (!data) return {};

        const stats: Record<string, ExtendedDailyStats> = {};

        for (const row of data.values) {
            const cols = data.columns;
            const date = row[cols.indexOf("date")] as string;
            const reviewedCardIds = this.getReviewedCardIds(date);

            stats[date] = {
                date,
                reviewsCompleted: row[cols.indexOf("reviews_completed")] as number,
                newCardsStudied: row[cols.indexOf("new_cards_studied")] as number,
                totalTimeMs: row[cols.indexOf("total_time_ms")] as number,
                again: row[cols.indexOf("again_count")] as number,
                hard: row[cols.indexOf("hard_count")] as number,
                good: row[cols.indexOf("good_count")] as number,
                easy: row[cols.indexOf("easy_count")] as number,
                newCards: row[cols.indexOf("new_cards")] as number,
                learningCards: row[cols.indexOf("learning_cards")] as number,
                reviewCards: row[cols.indexOf("review_cards")] as number,
                reviewedCardIds,
            };
        }

        return stats;
    }

    /**
     * Get total review count
     */
    getTotalReviewCount(): number {
        const result = this.db.exec(`SELECT COUNT(*) FROM review_log`);
        const data = getQueryResult(result);
        return data ? (data.values[0]![0] as number) : 0;
    }
}
