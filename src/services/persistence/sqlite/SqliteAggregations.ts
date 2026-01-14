/**
 * SQLite Aggregations
 * Aggregate queries for statistics panel
 */
import type { Database } from "sql.js";
import type { CardMaturityBreakdown } from "../../../types";
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
}
