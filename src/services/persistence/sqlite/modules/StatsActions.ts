/**
 * Stats Actions Module
 * Review log, daily statistics, and aggregate queries
 *
 * Consolidates functionality from SqliteDailyStatsRepo and SqliteAggregations
 * Uses SQL column aliases to map directly to interface properties where possible
 */
import type { CardReviewLogEntry, ExtendedDailyStats, CardMaturityBreakdown, CardsCreatedVsReviewedEntry, ProblemCard, StudyPattern, TimeToMasteryStats } from "types";
import { SqliteDatabase } from "../SqliteDatabase";
import { generateUUID } from "../sqlite.types";

/**
 * Review log entry with sync timestamps
 */
export interface ReviewLogForSync {
    id: string;
    cardId: string;
    reviewedAt: string;
    rating: number;
    scheduledDays: number;
    elapsedDays: number;
    state: number;
    timeSpentMs: number;
    updatedAt: number;
    deletedAt: number | null;
}

/**
 * Stats and aggregations operations
 */
export class StatsActions {
    constructor(private db: SqliteDatabase) {}

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
        const id = generateUUID();
        const reviewedAt = new Date().toISOString();
        const updatedAt = Date.now();

        this.db.run(`
            INSERT INTO review_log (
                id, card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, cardId, reviewedAt, rating, scheduledDays, elapsedDays, state, timeSpentMs, updatedAt]);
    }

    /**
     * Get review history for a card
     */
    getCardReviewHistory(cardId: string, limit = 20): CardReviewLogEntry[] {
        const rows = this.db.query<{
            t: string;
            r: number;
            s: number;
            e: number;
        }>(`
            SELECT reviewed_at as t, rating as r, scheduled_days as s, elapsed_days as e
            FROM review_log
            WHERE card_id = ? AND deleted_at IS NULL
            ORDER BY reviewed_at DESC
            LIMIT ?
        `, [cardId, limit]);

        return rows.map((row) => ({
            t: new Date(row.t).getTime(),
            r: row.r,
            s: row.s,
            e: row.e,
        }));
    }

    /**
     * Get total review count
     */
    getTotalReviewCount(): number {
        return this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM review_log WHERE deleted_at IS NULL`
        )?.count ?? 0;
    }

    // ===== Daily Stats =====

    /**
     * Get daily stats for a date (optimized with single JOIN query)
     */
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
            WHERE ds.date = ?
            GROUP BY ds.date
        `, [date]);

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
            reviewedCardIds: row.reviewed_card_ids ? row.reviewed_card_ids.split(",") : [],
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
    }

    /**
     * Record a reviewed card for daily limits
     */
    recordReviewedCard(date: string, cardId: string): void {
        this.db.run(`
            INSERT OR IGNORE INTO daily_reviewed_cards (date, card_id)
            VALUES (?, ?)
        `, [date, cardId]);
    }

    /**
     * Get all reviewed card IDs for a date
     */
    getReviewedCardIds(date: string): string[] {
        const rows = this.db.query<{ card_id: string }>(
            `SELECT card_id FROM daily_reviewed_cards WHERE date = ?`,
            [date]
        );
        return rows.map((r) => r.card_id);
    }

    /**
     * Remove a reviewed card entry (for undo)
     */
    removeReviewedCard(date: string, cardId: string): void {
        this.db.run(`
            DELETE FROM daily_reviewed_cards WHERE date = ? AND card_id = ?
        `, [date, cardId]);
    }

    /**
     * Rebuild daily_stats and daily_reviewed_cards from review_log
     * Called after sync to ensure stats are consistent across devices
     */
    rebuildDailyStatsFromReviewLog(): void {
        // Clear existing stats
        this.db.run(`DELETE FROM daily_stats`);
        this.db.run(`DELETE FROM daily_reviewed_cards`);

        // Rebuild daily_stats from review_log
        this.db.run(`
            INSERT INTO daily_stats (
                date, reviews_completed, new_cards_studied, total_time_ms,
                again_count, hard_count, good_count, easy_count
            )
            SELECT
                date(reviewed_at) as date,
                COUNT(*) as reviews_completed,
                SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new_cards_studied,
                COALESCE(SUM(time_spent_ms), 0) as total_time_ms,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as again_count,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as hard_count,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as good_count,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as easy_count
            FROM review_log
            WHERE deleted_at IS NULL
            GROUP BY date(reviewed_at)
        `);

        // Rebuild daily_reviewed_cards from review_log
        this.db.run(`
            INSERT INTO daily_reviewed_cards (date, card_id)
            SELECT DISTINCT date(reviewed_at), card_id
            FROM review_log
            WHERE deleted_at IS NULL
        `);
    }

    /**
     * Get all daily stats (optimized with single JOIN query)
     */
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
                reviewedCardIds: row.reviewed_card_ids ? row.reviewed_card_ids.split(",") : [],
            };
        }

        return stats;
    }

    /**
     * Get all daily stats summary (lightweight - no card IDs)
     */
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
                reviewedCardIds: [], // Empty - use getAllDailyStats() if you need card IDs
            };
        }

        return stats;
    }

    // ===== Aggregations =====

    /**
     * Get card maturity breakdown (for stats panel)
     */
    getCardMaturityBreakdown(): CardMaturityBreakdown {
        const row = this.db.get<{
            suspended: number;
            buried: number;
            new: number;
            learning: number;
            young: number;
            mature: number;
        }>(`
            SELECT
                SUM(CASE WHEN suspended = 1 THEN 1 ELSE 0 END) as suspended,
                SUM(CASE WHEN suspended = 0 AND buried_until > datetime('now') THEN 1 ELSE 0 END) as buried,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 0 THEN 1 ELSE 0 END) as new,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state IN (1, 3) THEN 1 ELSE 0 END) as learning,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 2 AND scheduled_days < 21 THEN 1 ELSE 0 END) as young,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 2 AND scheduled_days >= 21 THEN 1 ELSE 0 END) as mature
            FROM cards WHERE deleted_at IS NULL
        `);

        return {
            new: row?.new ?? 0,
            learning: row?.learning ?? 0,
            young: row?.young ?? 0,
            mature: row?.mature ?? 0,
            suspended: row?.suspended ?? 0,
            buried: row?.buried ?? 0,
        };
    }

    /**
     * Get due cards count by date range
     */
    getDueCardsByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        const rows = this.db.query<{ due_date: string; count: number }>(`
            SELECT date(due) as due_date, COUNT(*) as count
            FROM cards
            WHERE deleted_at IS NULL AND state != 0
              AND suspended = 0
              AND (buried_until IS NULL OR buried_until <= datetime('now'))
              AND date(due) BETWEEN ? AND ?
            GROUP BY date(due)
            ORDER BY due_date
        `, [startDate, endDate]);

        return rows.map((r) => ({ date: r.due_date, count: r.count }));
    }

    /**
     * Get problem cards (high lapses, low stability, or relearning state)
     */
    getProblemCards(limit = 20): ProblemCard[] {
        const rows = this.db.query<{
            id: string;
            question: string;
            lapses: number;
            stability: number;
            difficulty: number;
            problem_type: ProblemCard["problemType"];
        }>(`
            SELECT
                id,
                question,
                lapses,
                stability,
                difficulty,
                state,
                CASE
                    WHEN lapses > 3 THEN 'high_lapses'
                    WHEN stability < 2.0 THEN 'low_stability'
                    WHEN state = 3 THEN 'relearning'
                    ELSE 'unknown'
                END as problem_type
            FROM cards
            WHERE deleted_at IS NULL AND suspended = 0
              AND (
                lapses > 3
                OR stability < 2.0
                OR state = 3
              )
            ORDER BY
                lapses DESC,
                stability ASC
            LIMIT ?
        `, [limit]);

        return rows.map((r) => ({
            id: r.id,
            question: r.question || "",
            lapses: r.lapses,
            stability: r.stability,
            difficulty: r.difficulty,
            problemType: r.problem_type,
        }));
    }

    /**
     * Get study patterns from review history
     */
    getStudyPatterns(): StudyPattern {
        const rows = this.db.query<{
            day_of_week: number;
            hour_of_day: number;
            total_reviews: number;
            successful_reviews: number;
        }>(`
            SELECT
                CAST(strftime('%w', reviewed_at, 'localtime') AS INTEGER) as day_of_week,
                CAST(strftime('%H', reviewed_at, 'localtime') AS INTEGER) as hour_of_day,
                COUNT(*) as total_reviews,
                SUM(CASE WHEN rating >= 3 THEN 1 ELSE 0 END) as successful_reviews
            FROM review_log
            WHERE deleted_at IS NULL AND reviewed_at >= datetime('now', '-30 days')
            GROUP BY day_of_week, hour_of_day
            ORDER BY day_of_week, hour_of_day
        `);

        // Initialize empty pattern
        const pattern: StudyPattern = {
            bestDays: [],
            bestHours: [],
            heatmap: Array.from({ length: 7 }, () =>
                Array.from({ length: 24 }, (_, h) => ({
                    day: 0,
                    hour: h,
                    count: 0,
                    rate: 0,
                }))
            ),
        };

        // Build heatmap and aggregate stats
        const dayStats = new Map<number, { total: number; success: number }>();
        const hourStats = new Map<number, { total: number; success: number }>();

        for (const row of rows) {
            const day = row.day_of_week;
            const hour = row.hour_of_day;
            const total = row.total_reviews;
            const success = row.successful_reviews;
            const rate = total > 0 ? Math.round((success / total) * 100) : 0;

            // Update heatmap
            pattern.heatmap[day]![hour] = { day, hour, count: total, rate };

            // Aggregate by day
            const dayData = dayStats.get(day) || { total: 0, success: 0 };
            dayData.total += total;
            dayData.success += success;
            dayStats.set(day, dayData);

            // Aggregate by hour
            const hourData = hourStats.get(hour) || { total: 0, success: 0 };
            hourData.total += total;
            hourData.success += success;
            hourStats.set(hour, hourData);
        }

        // Calculate best days
        pattern.bestDays = Array.from(dayStats.entries())
            .map(([day, stats]) => ({
                day,
                successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
            }))
            .sort((a, b) => b.successRate - a.successRate);

        // Calculate best hours
        pattern.bestHours = Array.from(hourStats.entries())
            .map(([hour, stats]) => ({
                hour,
                successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
            }))
            .sort((a, b) => b.successRate - a.successRate);

        return pattern;
    }

    /**
     * Get cards created by date for historical chart
     */
    getCardsCreatedByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        const rows = this.db.query<{ created_date: string; count: number }>(`
            SELECT date(datetime(created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards
            WHERE deleted_at IS NULL AND created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
            GROUP BY created_date
            ORDER BY created_date
        `, [startDate, endDate]);

        return rows.map((r) => ({ date: r.created_date, count: r.count }));
    }

    /**
     * Get cards created on a specific date
     */
    getCardsCreatedOnDate(date: string): string[] {
        const rows = this.db.query<{ id: string }>(`
            SELECT id
            FROM cards
            WHERE deleted_at IS NULL AND created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) = ?
        `, [date]);

        return rows.map((r) => r.id);
    }

    /**
     * Get cards created vs reviewed comparison data
     */
    getCardsCreatedVsReviewed(startDate: string, endDate: string): CardsCreatedVsReviewedEntry[] {
        // Query 1: Cards created per day
        const createdRows = this.db.query<{ created_date: string; count: number }>(`
            SELECT date(datetime(created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards
            WHERE deleted_at IS NULL AND created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
            GROUP BY created_date
        `, [startDate, endDate]);

        // Query 2: Cards reviewed per day
        const reviewedRows = this.db.query<{ date: string; count: number }>(`
            SELECT date, reviews_completed as count
            FROM daily_stats
            WHERE date BETWEEN ? AND ?
        `, [startDate, endDate]);

        // Query 3: Cards created AND reviewed same day
        const sameDayRows = this.db.query<{ created_date: string; count: number }>(`
            SELECT date(datetime(c.created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards c
            INNER JOIN daily_reviewed_cards drc ON c.id = drc.card_id
            WHERE c.deleted_at IS NULL AND date(datetime(c.created_at / 1000, 'unixepoch', 'localtime')) = drc.date
              AND drc.date BETWEEN ? AND ?
            GROUP BY created_date
        `, [startDate, endDate]);

        // Parse results into maps
        const createdMap = new Map(createdRows.map((r) => [r.created_date, r.count]));
        const reviewedMap = new Map(reviewedRows.map((r) => [r.date, r.count]));
        const sameDayMap = new Map(sameDayRows.map((r) => [r.created_date, r.count]));

        // Get all unique dates
        const allDates = new Set([
            ...createdMap.keys(),
            ...reviewedMap.keys(),
            ...sameDayMap.keys(),
        ]);

        // Merge into result array
        const entries: CardsCreatedVsReviewedEntry[] = [];
        for (const date of allDates) {
            entries.push({
                date,
                created: createdMap.get(date) || 0,
                reviewed: reviewedMap.get(date) || 0,
                createdAndReviewedSameDay: sameDayMap.get(date) || 0,
            });
        }

        // Sort by date
        entries.sort((a, b) => a.date.localeCompare(b.date));

        return entries;
    }

    /**
     * Get time-to-mastery statistics
     * v15: No longer grouped by project (projects in frontmatter, not DB)
     * Returns single "All Cards" group
     */
    getTimeToMastery(): TimeToMasteryStats[] {
        const row = this.db.get<{
            avg_days: number;
            card_count: number;
        }>(`
            SELECT
                AVG(julianday(c.last_review) - julianday(datetime(c.created_at / 1000, 'unixepoch'))) as avg_days,
                COUNT(*) as card_count
            FROM cards c
            WHERE c.deleted_at IS NULL AND c.state = 2
              AND c.scheduled_days >= 21
              AND c.last_review IS NOT NULL
              AND c.created_at IS NOT NULL
        `);

        if (!row || row.card_count < 3) {
            return [];
        }

        return [{
            group: "All Cards",
            avgDays: Math.round(row.avg_days || 0),
            cardCount: row.card_count || 0,
        }];
    }

    // ===== Sync Operations =====

    /**
     * Get review log entries modified since timestamp (for sync push)
     */
    getModifiedReviewLogSince(timestamp: number): ReviewLogForSync[] {
        return this.db.query<ReviewLogForSync>(`
            SELECT
                id,
                card_id as cardId,
                reviewed_at as reviewedAt,
                rating,
                scheduled_days as scheduledDays,
                elapsed_days as elapsedDays,
                state,
                time_spent_ms as timeSpentMs,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM review_log
            WHERE updated_at > ?
        `, [timestamp]);
    }

    /**
     * Upsert review log entry from remote sync
     */
    upsertReviewLogFromRemote(data: ReviewLogForSync): void {
        this.db.run(`
            INSERT OR REPLACE INTO review_log (
                id, card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms, updated_at, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.id,
            data.cardId,
            data.reviewedAt,
            data.rating,
            data.scheduledDays,
            data.elapsedDays,
            data.state,
            data.timeSpentMs,
            data.updatedAt,
            data.deletedAt,
        ]);
    }

    /**
     * Get review log entry with sync fields (for LWW comparison)
     */
    getReviewLogForSync(id: string): ReviewLogForSync | null {
        return this.db.get<ReviewLogForSync>(`
            SELECT
                id,
                card_id as cardId,
                reviewed_at as reviewedAt,
                rating,
                scheduled_days as scheduledDays,
                elapsed_days as elapsedDays,
                state,
                time_spent_ms as timeSpentMs,
                updated_at as updatedAt,
                deleted_at as deletedAt
            FROM review_log WHERE id = ?
        `, [id]);
    }

    /**
     * Delete all review log entries (for force pull sync)
     */
    deleteAllReviewLogForSync(): void {
        this.db.run(`DELETE FROM review_log`);
    }
}
