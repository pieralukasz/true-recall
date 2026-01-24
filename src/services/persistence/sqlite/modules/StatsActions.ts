/**
 * Stats Actions Module
 * Review log, daily statistics, and aggregate queries
 *
 * Consolidates functionality from SqliteDailyStatsRepo and SqliteAggregations
 */
import type { CardReviewLogEntry, ExtendedDailyStats, CardMaturityBreakdown, CardsCreatedVsReviewedEntry, ProblemCard, StudyPattern, TimeToMasteryStats } from "types";
import { SqliteDatabase } from "../SqliteDatabase";
import { generateUUID } from "../sqlite.types";

// Database row types
interface DailyStatsRow {
    date: string;
    reviews_completed: number;
    new_cards_studied: number;
    total_time_ms: number;
    again_count: number;
    hard_count: number;
    good_count: number;
    easy_count: number;
    new_cards: number;
    learning_cards: number;
    review_cards: number;
}

interface DailyStatsWithCardsRow extends DailyStatsRow {
    reviewed_card_ids: string | null;
}

interface ReviewLogRow {
    t: number;
    r: number;
    s: number;
    e: number;
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

        this.db.run(`
            INSERT INTO review_log (
                id, card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, cardId, reviewedAt, rating, scheduledDays, elapsedDays, state, timeSpentMs]);
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
            WHERE card_id = ?
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
        const result = this.db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM review_log`
        );
        return result?.count ?? 0;
    }

    // ===== Daily Stats =====

    /**
     * Get daily stats for a date (optimized with single JOIN query)
     */
    getDailyStats(date: string): ExtendedDailyStats | null {
        const row = this.db.get<DailyStatsWithCardsRow>(`
            SELECT
                ds.*,
                GROUP_CONCAT(drc.card_id) as reviewed_card_ids
            FROM daily_stats ds
            LEFT JOIN daily_reviewed_cards drc ON ds.date = drc.date
            WHERE ds.date = ?
            GROUP BY ds.date
        `, [date]);

        if (!row) return null;

        const reviewedCardIds = row.reviewed_card_ids
            ? row.reviewed_card_ids.split(",")
            : [];

        return {
            date: row.date,
            reviewsCompleted: row.reviews_completed,
            newCardsStudied: row.new_cards_studied,
            totalTimeMs: row.total_time_ms,
            again: row.again_count,
            hard: row.hard_count,
            good: row.good_count,
            easy: row.easy_count,
            newCards: row.new_cards,
            learningCards: row.learning_cards,
            reviewCards: row.review_cards,
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
     * Get all daily stats (optimized with single JOIN query)
     */
    getAllDailyStats(): Record<string, ExtendedDailyStats> {
        const rows = this.db.query<DailyStatsWithCardsRow>(`
            SELECT
                ds.*,
                GROUP_CONCAT(drc.card_id) as reviewed_card_ids
            FROM daily_stats ds
            LEFT JOIN daily_reviewed_cards drc ON ds.date = drc.date
            GROUP BY ds.date
            ORDER BY ds.date
        `);

        const stats: Record<string, ExtendedDailyStats> = {};
        for (const row of rows) {
            const reviewedCardIds = row.reviewed_card_ids
                ? row.reviewed_card_ids.split(",")
                : [];

            stats[row.date] = {
                date: row.date,
                reviewsCompleted: row.reviews_completed,
                newCardsStudied: row.new_cards_studied,
                totalTimeMs: row.total_time_ms,
                again: row.again_count,
                hard: row.hard_count,
                good: row.good_count,
                easy: row.easy_count,
                newCards: row.new_cards,
                learningCards: row.learning_cards,
                reviewCards: row.review_cards,
                reviewedCardIds,
            };
        }

        return stats;
    }

    /**
     * Get all daily stats summary (lightweight - no card IDs)
     */
    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
        const rows = this.db.query<DailyStatsRow>(
            `SELECT * FROM daily_stats ORDER BY date`
        );

        const stats: Record<string, ExtendedDailyStats> = {};
        for (const row of rows) {
            stats[row.date] = {
                date: row.date,
                reviewsCompleted: row.reviews_completed,
                newCardsStudied: row.new_cards_studied,
                totalTimeMs: row.total_time_ms,
                again: row.again_count,
                hard: row.hard_count,
                good: row.good_count,
                easy: row.easy_count,
                newCards: row.new_cards,
                learningCards: row.learning_cards,
                reviewCards: row.review_cards,
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
            FROM cards
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
            WHERE state != 0
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
            WHERE suspended = 0
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
            WHERE reviewed_at >= datetime('now', '-30 days')
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
            WHERE created_at IS NOT NULL
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
            WHERE created_at IS NOT NULL
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
            WHERE created_at IS NOT NULL
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
            WHERE date(datetime(c.created_at / 1000, 'unixepoch', 'localtime')) = drc.date
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
     * Get time-to-mastery statistics grouped by project
     */
    getTimeToMastery(): TimeToMasteryStats[] {
        const rows = this.db.query<{
            project_name: string;
            avg_days: number;
            card_count: number;
        }>(`
            SELECT
                COALESCE(p.name, 'No Project') as project_name,
                AVG(julianday(c.last_review) - julianday(datetime(c.created_at / 1000, 'unixepoch'))) as avg_days,
                COUNT(*) as card_count
            FROM cards c
            LEFT JOIN source_notes sn ON c.source_uid = sn.uid
            LEFT JOIN note_projects np ON sn.uid = np.source_uid
            LEFT JOIN projects p ON np.project_id = p.id
            WHERE c.state = 2
              AND c.scheduled_days >= 21
              AND c.last_review IS NOT NULL
              AND c.created_at IS NOT NULL
            GROUP BY project_name
            HAVING card_count >= 3
            ORDER BY avg_days ASC
        `);

        return rows.map((r) => ({
            group: r.project_name,
            avgDays: Math.round(r.avg_days || 0),
            cardCount: r.card_count || 0,
        }));
    }
}
