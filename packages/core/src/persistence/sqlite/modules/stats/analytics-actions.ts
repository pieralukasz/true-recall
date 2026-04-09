import type {
	CardMaturityBreakdown,
	CardsCreatedVsReviewedEntry,
	CreationSourceStats,
	NotePerformanceRow,
	ProblemCard,
	StudyPattern,
	TimeToMasteryStats,
} from "../../../../types";
import type { SqliteDatabase } from "../../SqliteDatabase";
import { sqlPlaceholders } from "../../sql-utils";
import { toUtcIsoDayRange } from "./date-utils";

export class AnalyticsActions {
	constructor(private db: SqliteDatabase) {}

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

	getDueCardsByDate(
		startDate: string,
		endDate: string,
	): { date: string; count: number }[] {
		const rows = this.db.query<{ due_date: string; count: number }>(
			`
            SELECT date(due) as due_date, COUNT(*) as count
            FROM cards
            WHERE deleted_at IS NULL AND state != 0
              AND suspended = 0
              AND (buried_until IS NULL OR buried_until <= datetime('now'))
              AND date(due) BETWEEN ? AND ?
            GROUP BY date(due)
            ORDER BY due_date
        `,
			[startDate, endDate],
		);

		return rows.map((r: { due_date: string; count: number }) => ({
			date: r.due_date,
			count: r.count,
		}));
	}

	getProblemCards(limit = 20): ProblemCard[] {
		const rows = this.db.query<{
			id: string;
			fieldsJson: string;
			lapses: number;
			stability: number;
			difficulty: number;
			problem_type: ProblemCard["problemType"];
		}>(
			`
			SELECT
				c.id,
				n.fields_json AS fieldsJson,
				c.lapses,
				c.stability,
				c.difficulty,
				c.state,
				CASE
					WHEN c.lapses > 3 THEN 'high_lapses'
					WHEN c.stability < 2.0 THEN 'low_stability'
					WHEN c.state = 3 THEN 'relearning'
					ELSE 'unknown'
				END as problem_type
			FROM cards c
			JOIN notes n ON c.note_id = n.id
			WHERE c.deleted_at IS NULL AND c.suspended = 0
			  AND (c.lapses > 3 OR c.stability < 2.0 OR c.state = 3)
			ORDER BY c.lapses DESC, c.stability ASC
			LIMIT ?
		`,
			[limit],
		);

		let malformedCount = 0;
		const result = rows.map(
			(r: {
				id: string;
				fieldsJson: string;
				lapses: number;
				stability: number;
				difficulty: number;
				problem_type: ProblemCard["problemType"];
			}) => {
				let fields: Record<string, string> = {};
				try {
					fields = JSON.parse(r.fieldsJson) as Record<string, string>;
				} catch {
					malformedCount++;
				}
				return {
					id: r.id,
					question: Object.values(fields)[0] ?? "",
					lapses: r.lapses,
					stability: r.stability,
					difficulty: r.difficulty,
					problemType: r.problem_type,
				};
			},
		);
		if (malformedCount > 0) {
			console.error(
				`[AnalyticsActions] ${malformedCount} cards with malformed fields_json`,
			);
		}
		return result;
	}

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

		const pattern: StudyPattern = {
			bestDays: [],
			bestHours: [],
			heatmap: Array.from({ length: 7 }, () =>
				Array.from({ length: 24 }, (_: unknown, h: number) => ({
					day: 0,
					hour: h,
					count: 0,
					rate: 0,
				})),
			),
		};

		const dayStats = new Map<number, { total: number; success: number }>();
		const hourStats = new Map<number, { total: number; success: number }>();

		for (const row of rows) {
			const day = row.day_of_week;
			const hour = row.hour_of_day;
			const total = row.total_reviews;
			const success = row.successful_reviews;
			const rate = total > 0 ? Math.round((success / total) * 100) : 0;

			const dayRow = pattern.heatmap[day];
			if (dayRow) {
				dayRow[hour] = { day, hour, count: total, rate };
			}

			const dayData = dayStats.get(day) || { total: 0, success: 0 };
			dayData.total += total;
			dayData.success += success;
			dayStats.set(day, dayData);

			const hourData = hourStats.get(hour) || { total: 0, success: 0 };
			hourData.total += total;
			hourData.success += success;
			hourStats.set(hour, hourData);
		}

		pattern.bestDays = Array.from(dayStats.entries())
			.map(([day, stats]: [number, { total: number; success: number }]) => ({
				day,
				successRate:
					stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
			}))
			.sort(
				(
					a: { day: number; successRate: number },
					b: { day: number; successRate: number },
				) => b.successRate - a.successRate,
			);

		pattern.bestHours = Array.from(hourStats.entries())
			.map(([hour, stats]: [number, { total: number; success: number }]) => ({
				hour,
				successRate:
					stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
			}))
			.sort(
				(
					a: { hour: number; successRate: number },
					b: { hour: number; successRate: number },
				) => b.successRate - a.successRate,
			);

		return pattern;
	}

	getCardsCreatedByDate(
		startDate: string,
		endDate: string,
	): { date: string; count: number }[] {
		const rows = this.db.query<{ created_date: string; count: number }>(
			`
            SELECT date(datetime(created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards
            WHERE deleted_at IS NULL AND created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
            GROUP BY created_date
            ORDER BY created_date
        `,
			[startDate, endDate],
		);

		return rows.map((r: { created_date: string; count: number }) => ({
			date: r.created_date,
			count: r.count,
		}));
	}

	getCardsCreatedOnDate(date: string): string[] {
		const rows = this.db.query<{ id: string }>(
			`
            SELECT id
            FROM cards
            WHERE deleted_at IS NULL AND created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) = ?
        `,
			[date],
		);

		return rows.map((r: { id: string }) => r.id);
	}

	getCardsCreatedVsReviewed(
		startDate: string,
		endDate: string,
	): CardsCreatedVsReviewedEntry[] {
		const createdRows = this.db.query<{
			created_date: string;
			count: number;
		}>(
			`
            SELECT date(datetime(created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards
            WHERE deleted_at IS NULL AND created_at IS NOT NULL
              AND date(datetime(created_at / 1000, 'unixepoch', 'localtime')) BETWEEN ? AND ?
            GROUP BY created_date
        `,
			[startDate, endDate],
		);

		const reviewedRows = this.db.query<{ date: string; count: number }>(
			`
            SELECT date, reviews_completed as count
            FROM daily_stats
            WHERE date BETWEEN ? AND ?
        `,
			[startDate, endDate],
		);

		const sameDayRows = this.db.query<{
			created_date: string;
			count: number;
		}>(
			`
            SELECT date(datetime(c.created_at / 1000, 'unixepoch', 'localtime')) as created_date,
                   COUNT(*) as count
            FROM cards c
            INNER JOIN daily_reviewed_cards drc ON c.id = drc.card_id
            WHERE c.deleted_at IS NULL AND date(datetime(c.created_at / 1000, 'unixepoch', 'localtime')) = drc.date
              AND drc.date BETWEEN ? AND ?
            GROUP BY created_date
        `,
			[startDate, endDate],
		);

		const createdMap = new Map(
			createdRows.map((r: { created_date: string; count: number }) => [
				r.created_date,
				r.count,
			]),
		);
		const reviewedMap = new Map(
			reviewedRows.map((r: { date: string; count: number }) => [
				r.date,
				r.count,
			]),
		);
		const sameDayMap = new Map(
			sameDayRows.map((r: { created_date: string; count: number }) => [
				r.created_date,
				r.count,
			]),
		);

		const allDates = new Set([
			...createdMap.keys(),
			...reviewedMap.keys(),
			...sameDayMap.keys(),
		]);

		const entries: CardsCreatedVsReviewedEntry[] = [];
		for (const date of allDates) {
			entries.push({
				date,
				created: createdMap.get(date) || 0,
				reviewed: reviewedMap.get(date) || 0,
				createdAndReviewedSameDay: sameDayMap.get(date) || 0,
			});
		}

		entries.sort(
			(a: CardsCreatedVsReviewedEntry, b: CardsCreatedVsReviewedEntry) =>
				a.date.localeCompare(b.date),
		);

		return entries;
	}

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

		return [
			{
				group: "All Cards",
				avgDays: Math.round(row.avg_days || 0),
				cardCount: row.card_count || 0,
			},
		];
	}

	getReviewsForRetention(
		startDate: string,
		endDate: string,
		presetNames?: string[],
	): { date: string; rating: number }[] {
		let presetClause = "";
		const params: (string | number | null)[] = [];
		const { startIso, endExclusiveIso } = toUtcIsoDayRange(startDate, endDate);

		if (presetNames && presetNames.length > 0) {
			presetClause = `AND COALESCE(r.preset_name, 'Default') IN (${sqlPlaceholders(presetNames.length)})`;
			params.push(...presetNames);
		}

		params.push(startIso, endExclusiveIso);

		return this.db.query<{ date: string; rating: number }>(
			`
            SELECT
                substr(r.reviewed_at, 1, 10) as date,
                r.rating
            FROM review_log r
            JOIN cards c ON r.card_id = c.id
            WHERE r.deleted_at IS NULL
              AND c.deleted_at IS NULL
              AND r.state = 2
              ${presetClause}
              AND r.reviewed_at >= ?
              AND r.reviewed_at < ?
        `,
			params,
		);
	}

	getTrueRetention(startDate: string, endDate: string): number {
		const { startIso, endExclusiveIso } = toUtcIsoDayRange(startDate, endDate);
		const row = this.db.get<{ retention: number | null }>(
			`
            SELECT
                CAST(SUM(CASE WHEN rating >= 3 THEN 1 ELSE 0 END) AS REAL) /
                NULLIF(CAST(COUNT(*) AS REAL), 0) as retention
            FROM review_log r
            JOIN cards c ON r.card_id = c.id
            WHERE r.deleted_at IS NULL
              AND c.deleted_at IS NULL
              AND r.state = 2
              AND r.reviewed_at >= ?
              AND r.reviewed_at < ?
        `,
			[startIso, endExclusiveIso],
		);

		return row?.retention ?? 0;
	}

	getForecastDueByDay(days: number): { date: string; count: number }[] {
		return this.db.query<{ date: string; count: number }>(
			`
            SELECT date(due) as date, COUNT(*) as count
            FROM cards
            WHERE deleted_at IS NULL
              AND suspended = 0
              AND (buried_until IS NULL OR buried_until <= datetime('now'))
              AND state != 0
              AND date(due) BETWEEN date('now') AND date('now', '+' || ? || ' days')
            GROUP BY date(due)
            ORDER BY date
        `,
			[days],
		);
	}

	getSiblingCards(sourceUid: string): {
		id: string;
		due: string;
		scheduledDays: number;
	}[] {
		return this.db.query<{
			id: string;
			due: string;
			scheduledDays: number;
		}>(
			`
            SELECT id, due, scheduled_days as scheduledDays
            FROM cards
            WHERE source_uid = ?
              AND deleted_at IS NULL
              AND suspended = 0
            ORDER BY due ASC
        `,
			[sourceUid],
		);
	}

	getNotePerformance(): NotePerformanceRow[] {
		return this.db.query<NotePerformanceRow>(
			`
            SELECT
                c.source_uid as sourceUid,
                COUNT(DISTINCT c.id) as cardCount,
                AVG(c.lapses) as avgLapses,
                AVG(c.difficulty) as avgDifficulty,
                COUNT(r.id) as reviewCount,
                ROUND(100.0 * SUM(CASE WHEN r.rating >= 3 THEN 1 ELSE 0 END) /
                      NULLIF(COUNT(r.id), 0), 1) as retentionRate,
                MAX(r.reviewed_at) as lastReviewed
            FROM cards c
            LEFT JOIN review_log r
                ON c.id = r.card_id AND r.deleted_at IS NULL AND r.state = 2
            WHERE c.deleted_at IS NULL
              AND c.suspended = 0
              AND c.source_uid IS NOT NULL
            GROUP BY c.source_uid
            ORDER BY retentionRate ASC
        `,
			[],
		);
	}

	getCreationSourcePerformance(): CreationSourceStats[] {
		return this.db.query<CreationSourceStats>(
			`
			SELECT
				COALESCE(n.created_via, 'manual') as source,
				COUNT(DISTINCT c.id) as cardCount,
				AVG(c.lapses) as avgLapses,
				ROUND(100.0 * SUM(CASE WHEN r.rating >= 3 THEN 1 ELSE 0 END) /
					  NULLIF(COUNT(r.id), 0), 1) as retentionRate
			FROM cards c
			JOIN notes n ON c.note_id = n.id
			LEFT JOIN review_log r
				ON c.id = r.card_id AND r.deleted_at IS NULL AND r.state = 2
			WHERE c.deleted_at IS NULL
			GROUP BY source
			ORDER BY source ASC
		`,
			[],
		);
	}

	getNotePerformanceFiltered(
		excludeSourceUids: string[],
		includeSourceUids?: string[],
	): NotePerformanceRow[] {
		let excludeClause = "";
		let includeClause = "";
		const params: (string | number | null)[] = [];

		if (excludeSourceUids.length > 0) {
			excludeClause = `AND c.source_uid NOT IN (${sqlPlaceholders(excludeSourceUids.length)})`;
			params.push(...excludeSourceUids);
		}

		if (includeSourceUids) {
			if (includeSourceUids.length === 0) return [];
			includeClause = `AND c.source_uid IN (${sqlPlaceholders(includeSourceUids.length)})`;
			params.push(...includeSourceUids);
		}

		return this.db.query<NotePerformanceRow>(
			`
			SELECT
				c.source_uid as sourceUid,
				COUNT(DISTINCT c.id) as cardCount,
				AVG(c.lapses) as avgLapses,
				AVG(c.difficulty) as avgDifficulty,
				COUNT(r.id) as reviewCount,
				ROUND(100.0 * SUM(CASE WHEN r.rating >= 3 THEN 1 ELSE 0 END) /
					  NULLIF(COUNT(r.id), 0), 1) as retentionRate,
				MAX(r.reviewed_at) as lastReviewed
			FROM cards c
			LEFT JOIN review_log r
				ON c.id = r.card_id AND r.deleted_at IS NULL AND r.state = 2
			WHERE c.deleted_at IS NULL
			  AND c.suspended = 0
			  AND c.source_uid IS NOT NULL
			  ${excludeClause}
			  ${includeClause}
			GROUP BY c.source_uid
			ORDER BY retentionRate ASC
		`,
			params,
		);
	}
}
