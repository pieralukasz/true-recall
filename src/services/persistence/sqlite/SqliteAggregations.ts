/**
 * SQLite Aggregations
 * Aggregate queries for statistics panel
 */
import type { Database } from "sql.js";
import type { CardMaturityBreakdown, CardsCreatedVsReviewedEntry, ProblemCard, StudyPattern, TimeToMasteryStats } from "../../../types";
import { getQueryResult } from "./sqlite.types";

/**
 * Provides aggregate queries for statistics
 */
export class SqliteAggregations {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    /**
     * Get card maturity breakdown (for stats panel)
     */
    getCardMaturityBreakdown(): CardMaturityBreakdown {
        const result = this.db.exec(`
            SELECT
                SUM(CASE WHEN suspended = 1 THEN 1 ELSE 0 END) as suspended,
                SUM(CASE WHEN suspended = 0 AND buried_until > datetime('now') THEN 1 ELSE 0 END) as buried,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 0 THEN 1 ELSE 0 END) as new,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state IN (1, 3) THEN 1 ELSE 0 END) as learning,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 2 AND scheduled_days < 21 THEN 1 ELSE 0 END) as young,
                SUM(CASE WHEN suspended = 0 AND (buried_until IS NULL OR buried_until <= datetime('now')) AND state = 2 AND scheduled_days >= 21 THEN 1 ELSE 0 END) as mature
            FROM cards
        `);

        const data = getQueryResult(result);
        if (!data) {
            return { new: 0, learning: 0, young: 0, mature: 0, suspended: 0, buried: 0 };
        }

        const row = data.values[0]!;
        return {
            suspended: (row[0] as number) || 0,
            buried: (row[1] as number) || 0,
            new: (row[2] as number) || 0,
            learning: (row[3] as number) || 0,
            young: (row[4] as number) || 0,
            mature: (row[5] as number) || 0,
        };
    }

    /**
     * Get due cards count by date range
     */
    getDueCardsByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        const result = this.db.exec(`
            SELECT date(due) as due_date, COUNT(*) as count
            FROM cards
            WHERE state != 0
              AND suspended = 0
              AND (buried_until IS NULL OR buried_until <= datetime('now'))
              AND date(due) BETWEEN ? AND ?
            GROUP BY date(due)
            ORDER BY due_date
        `, [startDate, endDate]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => ({
            date: row[0] as string,
            count: row[1] as number,
        }));
    }

    /**
     * Get problem cards (high lapses, low stability, or relearning state)
     * Useful for identifying cards that need attention
     */
    getProblemCards(limit = 20): ProblemCard[] {
        const result = this.db.exec(`
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

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => ({
            id: row[0] as string,
            question: (row[1] as string) || "",
            lapses: (row[2] as number) || 0,
            stability: (row[3] as number) || 0,
            difficulty: (row[4] as number) || 0,
            problemType: row[6] as ProblemCard["problemType"],
        }));
    }

    /**
     * Get study patterns from review history
     * Analyzes when the user studies and their success rates
     */
    getStudyPatterns(): StudyPattern {
        // Get reviews from last 30 days grouped by day of week and hour
        // Note: reviewed_at is stored as UTC (datetime('now')), so we use 'localtime'
        // modifier to convert to user's local timezone for accurate heatmap display
        const result = this.db.exec(`
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

        const data = getQueryResult(result);

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

        if (!data) return pattern;

        // Build heatmap and aggregate stats
        const dayStats: Map<number, { total: number; success: number }> = new Map();
        const hourStats: Map<number, { total: number; success: number }> = new Map();

        for (const row of data.values) {
            const day = row[0] as number;
            const hour = row[1] as number;
            const total = row[2] as number;
            const success = row[3] as number;
            const rate = total > 0 ? Math.round((success / total) * 100) : 0;

            // Update heatmap
            pattern.heatmap[day]![hour] = {
                day,
                hour,
                count: total,
                rate,
            };

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
     * @param startDate ISO date string (YYYY-MM-DD)
     * @param endDate ISO date string (YYYY-MM-DD)
     */
    getCardsCreatedByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        const result = this.db.exec(`
            SELECT date(datetime(created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards
            WHERE created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
            GROUP BY created_date
            ORDER BY created_date
        `, [startDate, endDate]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => ({
            date: row[0] as string,
            count: row[1] as number,
        }));
    }

    /**
     * Get cards created on a specific date
     * @param date ISO date string (YYYY-MM-DD)
     */
    getCardsCreatedOnDate(date: string): string[] {
        const result = this.db.exec(`
            SELECT id
            FROM cards
            WHERE created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) = ?
        `, [date]);

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => row[0] as string);
    }

    /**
     * Get cards created vs reviewed comparison data
     * Shows for each day: created count, reviewed count, and same-day reviewed count
     * @param startDate ISO date string (YYYY-MM-DD)
     * @param endDate ISO date string (YYYY-MM-DD)
     */
    getCardsCreatedVsReviewed(startDate: string, endDate: string): CardsCreatedVsReviewedEntry[] {
        // Query 1: Cards created per day
        const createdResult = this.db.exec(`
            SELECT date(datetime(created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards
            WHERE created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
            GROUP BY created_date
        `, [startDate, endDate]);

        // Query 2: Cards reviewed per day (from daily_stats)
        const reviewedResult = this.db.exec(`
            SELECT date, reviews_completed as count
            FROM daily_stats
            WHERE date BETWEEN ? AND ?
        `, [startDate, endDate]);

        // Query 3: Cards created AND reviewed same day
        const sameDayResult = this.db.exec(`
            SELECT date(datetime(c.created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards c
            INNER JOIN daily_reviewed_cards drc ON c.id = drc.card_id
            WHERE date(datetime(c.created_at / 1000, 'unixepoch', 'localtime')) = drc.date
              AND drc.date BETWEEN ? AND ?
            GROUP BY created_date
        `, [startDate, endDate]);

        // Parse results into maps
        const createdMap = new Map<string, number>();
        const createdData = getQueryResult(createdResult);
        if (createdData) {
            for (const row of createdData.values) {
                createdMap.set(row[0] as string, row[1] as number);
            }
        }

        const reviewedMap = new Map<string, number>();
        const reviewedData = getQueryResult(reviewedResult);
        if (reviewedData) {
            for (const row of reviewedData.values) {
                reviewedMap.set(row[0] as string, row[1] as number);
            }
        }

        const sameDayMap = new Map<string, number>();
        const sameDayData = getQueryResult(sameDayResult);
        if (sameDayData) {
            for (const row of sameDayData.values) {
                sameDayMap.set(row[0] as string, row[1] as number);
            }
        }

        // Get all unique dates
        const allDates = new Set<string>([
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
     * Mastery is defined as scheduled_days >= 21
     */
    getTimeToMastery(): TimeToMasteryStats[] {
        // Get cards that have reached mastery and calculate time from creation
        const result = this.db.exec(`
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

        const data = getQueryResult(result);
        if (!data) return [];

        return data.values.map((row) => ({
            group: row[0] as string,
            avgDays: Math.round((row[1] as number) || 0),
            cardCount: (row[2] as number) || 0,
        }));
    }
}
