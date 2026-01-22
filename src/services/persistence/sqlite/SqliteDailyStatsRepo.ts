/**
 * SQLite Daily Stats Repository
 * Review log and daily statistics operations
 */
import type { CardReviewLogEntry, ExtendedDailyStats } from "../../../types";
import { getQueryResult, type DatabaseLike } from "./sqlite.types";

/**
 * Repository for daily stats and review log operations
 */
export class SqliteDailyStatsRepo {
    private db: DatabaseLike;
    private onDataChange: () => void;

    constructor(db: DatabaseLike, onDataChange: () => void) {
        this.db = db;
        this.onDataChange = onDataChange;
    }

    /**
     * Log a change to sync_log for Server-Side Merge sync
     */
    private logChange(
        op: "INSERT" | "UPDATE" | "DELETE",
        tableName: string,
        rowId: string,
        data?: unknown
    ): void {
        this.db.run(
            `INSERT INTO sync_log (id, operation, table_name, row_id, data, timestamp, synced)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [
                crypto.randomUUID(),
                op,
                tableName,
                rowId,
                data ? JSON.stringify(data) : null,
                Date.now(),
            ]
        );
    }

    // ===== Review Log =====

    /**
     * Add a review log entry with UUID primary key
     */
    addReviewLog(
        cardId: string,
        rating: number,
        scheduledDays: number,
        elapsedDays: number,
        state: number,
        timeSpentMs: number
    ): void {
        const id = this.generateUUID();
        const reviewedAt = new Date().toISOString();

        this.db.run(`
            INSERT INTO review_log (
                id, card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, cardId, reviewedAt, rating, scheduledDays, elapsedDays, state, timeSpentMs]);

        // Log change for sync
        const syncData = {
            id,
            card_id: cardId,
            reviewed_at: reviewedAt,
            rating,
            scheduled_days: scheduledDays,
            elapsed_days: elapsedDays,
            state,
            time_spent_ms: timeSpentMs,
        };
        this.logChange("INSERT", "review_log", id, syncData);

        this.onDataChange();
    }

    /**
     * Generate a UUID v4 string
     */
    private generateUUID(): string {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for environments without crypto.randomUUID
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
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
     * Get daily stats for a date (optimized with single JOIN query)
     */
    getDailyStats(date: string): ExtendedDailyStats | null {
        const result = this.db.exec(`
            SELECT
                ds.*,
                GROUP_CONCAT(drc.card_id) as reviewed_card_ids
            FROM daily_stats ds
            LEFT JOIN daily_reviewed_cards drc ON ds.date = drc.date
            WHERE ds.date = ?
            GROUP BY ds.date
        `, [date]);

        const data = getQueryResult(result);
        if (!data) return null;

        const row = data.values[0]!;
        const cols = data.columns;

        const reviewedCardIdsStr = row[cols.indexOf("reviewed_card_ids")] as string | null;
        const reviewedCardIds = reviewedCardIdsStr
            ? reviewedCardIdsStr.split(",")
            : [];

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
        // Check if exists to determine INSERT vs UPDATE
        const existing = this.getDailyStats(date);
        const isUpdate = existing !== null;

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

        // Log change for sync (fetch updated row)
        const updated = this.getDailyStats(date);
        if (updated) {
            const syncData = {
                date,
                reviews_completed: updated.reviewsCompleted,
                new_cards_studied: updated.newCardsStudied,
                total_time_ms: updated.totalTimeMs,
                again_count: updated.again,
                hard_count: updated.hard,
                good_count: updated.good,
                easy_count: updated.easy,
                new_cards: updated.newCards,
                learning_cards: updated.learningCards,
                review_cards: updated.reviewCards,
            };
            this.logChange(isUpdate ? "UPDATE" : "INSERT", "daily_stats", date, syncData);
        }

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

        // Log change for sync (fetch updated row)
        const updated = this.getDailyStats(date);
        if (updated) {
            const syncData = {
                date,
                reviews_completed: updated.reviewsCompleted,
                new_cards_studied: updated.newCardsStudied,
                total_time_ms: updated.totalTimeMs,
                again_count: updated.again,
                hard_count: updated.hard,
                good_count: updated.good,
                easy_count: updated.easy,
                new_cards: updated.newCards,
                learning_cards: updated.learningCards,
                review_cards: updated.reviewCards,
            };
            this.logChange("UPDATE", "daily_stats", date, syncData);
        }

        this.onDataChange();
    }

    /**
     * Record a reviewed card for daily limits
     */
    recordReviewedCard(date: string, cardId: string): void {
        // Check if already exists (INSERT OR IGNORE)
        const existing = this.db.exec(`
            SELECT 1 FROM daily_reviewed_cards WHERE date = ? AND card_id = ?
        `, [date, cardId]);
        const alreadyExists = getQueryResult(existing) !== null;

        this.db.run(`
            INSERT OR IGNORE INTO daily_reviewed_cards (date, card_id)
            VALUES (?, ?)
        `, [date, cardId]);

        // Only log if this is a new insert
        if (!alreadyExists) {
            const rowId = `${date}:${cardId}`; // Composite key
            const syncData = { date, card_id: cardId };
            this.logChange("INSERT", "daily_reviewed_cards", rowId, syncData);
        }

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

        const rowId = `${date}:${cardId}`; // Composite key
        this.logChange("DELETE", "daily_reviewed_cards", rowId);

        this.onDataChange();
    }

    /**
     * Get all daily stats (optimized with single JOIN query)
     */
    getAllDailyStats(): Record<string, ExtendedDailyStats> {
        const result = this.db.exec(`
            SELECT
                ds.*,
                GROUP_CONCAT(drc.card_id) as reviewed_card_ids
            FROM daily_stats ds
            LEFT JOIN daily_reviewed_cards drc ON ds.date = drc.date
            GROUP BY ds.date
            ORDER BY ds.date
        `);
        const data = getQueryResult(result);
        if (!data) return {};

        const stats: Record<string, ExtendedDailyStats> = {};
        const cols = data.columns;

        // Cache column indices once
        const dateIdx = cols.indexOf("date");
        const reviewsCompletedIdx = cols.indexOf("reviews_completed");
        const newCardsStudiedIdx = cols.indexOf("new_cards_studied");
        const totalTimeMsIdx = cols.indexOf("total_time_ms");
        const againCountIdx = cols.indexOf("again_count");
        const hardCountIdx = cols.indexOf("hard_count");
        const goodCountIdx = cols.indexOf("good_count");
        const easyCountIdx = cols.indexOf("easy_count");
        const newCardsIdx = cols.indexOf("new_cards");
        const learningCardsIdx = cols.indexOf("learning_cards");
        const reviewCardsIdx = cols.indexOf("review_cards");
        const reviewedCardIdsIdx = cols.indexOf("reviewed_card_ids");

        for (const row of data.values) {
            const date = row[dateIdx] as string;
            const reviewedCardIdsStr = row[reviewedCardIdsIdx] as string | null;
            const reviewedCardIds = reviewedCardIdsStr
                ? reviewedCardIdsStr.split(",")
                : [];

            stats[date] = {
                date,
                reviewsCompleted: row[reviewsCompletedIdx] as number,
                newCardsStudied: row[newCardsStudiedIdx] as number,
                totalTimeMs: row[totalTimeMsIdx] as number,
                again: row[againCountIdx] as number,
                hard: row[hardCountIdx] as number,
                good: row[goodCountIdx] as number,
                easy: row[easyCountIdx] as number,
                newCards: row[newCardsIdx] as number,
                learningCards: row[learningCardsIdx] as number,
                reviewCards: row[reviewCardsIdx] as number,
                reviewedCardIds,
            };
        }

        return stats;
    }

    /**
     * Get all daily stats summary (lightweight - no card IDs)
     * Use this for charts and heatmaps where individual card IDs aren't needed.
     * Much faster than getAllDailyStats() as it avoids GROUP_CONCAT and JOIN.
     */
    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
        const result = this.db.exec(`
            SELECT * FROM daily_stats ORDER BY date
        `);
        const data = getQueryResult(result);
        if (!data) return {};

        const stats: Record<string, ExtendedDailyStats> = {};
        const cols = data.columns;

        // Cache column indices once
        const dateIdx = cols.indexOf("date");
        const reviewsCompletedIdx = cols.indexOf("reviews_completed");
        const newCardsStudiedIdx = cols.indexOf("new_cards_studied");
        const totalTimeMsIdx = cols.indexOf("total_time_ms");
        const againCountIdx = cols.indexOf("again_count");
        const hardCountIdx = cols.indexOf("hard_count");
        const goodCountIdx = cols.indexOf("good_count");
        const easyCountIdx = cols.indexOf("easy_count");
        const newCardsIdx = cols.indexOf("new_cards");
        const learningCardsIdx = cols.indexOf("learning_cards");
        const reviewCardsIdx = cols.indexOf("review_cards");

        for (const row of data.values) {
            const date = row[dateIdx] as string;

            stats[date] = {
                date,
                reviewsCompleted: row[reviewsCompletedIdx] as number,
                newCardsStudied: row[newCardsStudiedIdx] as number,
                totalTimeMs: row[totalTimeMsIdx] as number,
                again: row[againCountIdx] as number,
                hard: row[hardCountIdx] as number,
                good: row[goodCountIdx] as number,
                easy: row[easyCountIdx] as number,
                newCards: row[newCardsIdx] as number,
                learningCards: row[learningCardsIdx] as number,
                reviewCards: row[reviewCardsIdx] as number,
                reviewedCardIds: [], // Empty array - use getAllDailyStats() if you need card IDs
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
