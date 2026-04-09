import type {
	CardMaturityBreakdown,
	ProblemCard,
	StudyPattern,
} from "../../../../types";
import type { SqliteDatabase } from "../../SqliteDatabase";

export class AnalyticsCardActions {
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
				`[AnalyticsCardActions] ${malformedCount} cards with malformed fields_json`,
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
}
