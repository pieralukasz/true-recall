import { formatLocalDate } from "../../../../utils";
import { getCurrentDeviceId } from "../../device-context";
import type { SqliteDatabase } from "../../SqliteDatabase";
import { generateUUID } from "../../sqlite.types";

export type ReviewKind = "review" | "preview";

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
	presetName: string | null;
	deviceId: string | null;
	reviewKind: string | null;
}

interface PresetDailyProgressRow {
	presetName: string;
	newStudied: number;
	reviewsCompleted: number;
}

export class ReviewLogActions {
	constructor(private db: SqliteDatabase) {}

	addReviewLog(
		cardId: string,
		rating: number,
		scheduledDays: number,
		elapsedDays: number,
		state: number,
		timeSpentMs: number,
		presetName?: string,
		kind: ReviewKind = "review",
	): string {
		const id = generateUUID();
		const reviewedAt = new Date().toISOString();
		const updatedAt = Date.now();

		this.db.run(
			`
            INSERT INTO review_log (
                id, card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms, updated_at, preset_name,
                device_id, review_kind
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
			[
				id,
				cardId,
				reviewedAt,
				rating,
				scheduledDays,
				elapsedDays,
				state,
				timeSpentMs,
				updatedAt,
				presetName ?? null,
				getCurrentDeviceId(),
				kind,
			],
		);
		return id;
	}

	/** Tombstone a review entry (review undo) so replay and sync ignore it. */
	markReviewLogDeleted(id: string): void {
		const now = Date.now();
		this.db.run(
			`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE id = ?`,
			[now, now, id],
		);
	}

	getCardReviewHistory(
		cardId: string,
		limit = 20,
	): { t: number; r: number; s: number; e: number }[] {
		const rows = this.db.query<{
			t: string;
			r: number;
			s: number;
			e: number;
		}>(
			`
            SELECT reviewed_at as t, rating as r,
                   scheduled_days as s, elapsed_days as e
            FROM review_log
            WHERE card_id = ? AND deleted_at IS NULL
            ORDER BY reviewed_at DESC
            LIMIT ?
        `,
			[cardId, limit],
		);

		return rows.map((row: { t: string; r: number; s: number; e: number }) => ({
			t: new Date(row.t).getTime(),
			r: row.r,
			s: row.s,
			e: row.e,
		}));
	}

	getCardIdsRatedInRange(
		rating: number,
		startIso: string,
		endIso: string,
	): string[] {
		return this.db
			.query<{ cardId: string }>(
				`SELECT DISTINCT card_id AS cardId
				 FROM review_log
				 WHERE deleted_at IS NULL
				   AND rating = ?
				   AND reviewed_at >= ?
				   AND reviewed_at < ?`,
				[rating, startIso, endIso],
			)
			.map((row) => row.cardId);
	}

	getTotalReviewCount(): number {
		return (
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count
				 FROM review_log WHERE deleted_at IS NULL`,
			)?.count ?? 0
		);
	}

	getReviewCountForPreset(presetName: string): number {
		const isDefault = presetName === "Default";
		return (
			this.db.get<{ count: number }>(
				`SELECT COUNT(*) as count FROM review_log
				 WHERE deleted_at IS NULL
				   AND (preset_name = ?
				        OR (? = 1 AND preset_name IS NULL))`,
				[presetName, isDefault ? 1 : 0],
			)?.count ?? 0
		);
	}

	getPresetProgressInRange(
		startIso: string,
		endIso: string,
	): PresetDailyProgressRow[] {
		const rows = this.db.query<{
			presetName: string;
			newStudied: number;
			reviewsCompleted: number;
		}>(
			`SELECT
				COALESCE(preset_name, 'Default') as presetName,
				SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as newStudied,
				SUM(CASE WHEN state = 2 THEN 1 ELSE 0 END)
					as reviewsCompleted
			FROM review_log
			WHERE deleted_at IS NULL
			  AND reviewed_at >= ?
			  AND reviewed_at < ?
			GROUP BY COALESCE(preset_name, 'Default')`,
			[startIso, endIso],
		);

		return rows.map(
			(row: {
				presetName: string;
				newStudied: number;
				reviewsCompleted: number;
			}) => ({
				presetName: row.presetName,
				newStudied: row.newStudied ?? 0,
				reviewsCompleted: row.reviewsCompleted ?? 0,
			}),
		);
	}

	updateReviewLogPresetName(oldName: string, newName: string): void {
		this.db.run(
			`UPDATE review_log
			 SET preset_name = ?, updated_at = ?
			 WHERE preset_name = ?`,
			[newName, Date.now(), oldName],
		);
	}

	getAnswerStreakInfo(): {
		current: number;
		todayBest: number;
		allTimeBest: number;
	} {
		const rows = this.db.query<{
			rating: number;
			reviewed_at: string;
		}>(
			`SELECT rating, reviewed_at FROM review_log
			 WHERE deleted_at IS NULL
			 ORDER BY reviewed_at DESC
			 LIMIT 5000`,
			[],
		);

		if (rows.length === 0) {
			return { current: 0, todayBest: 0, allTimeBest: 0 };
		}

		let current = 0;
		for (const row of rows) {
			if (row.rating >= 3) current++;
			else break;
		}

		let allTimeBest = 0;
		let run = 0;
		for (const row of rows) {
			if (row.rating >= 3) {
				run++;
				if (run > allTimeBest) allTimeBest = run;
			} else {
				run = 0;
			}
		}

		const todayStr = formatLocalDate(new Date());
		let todayBest = 0;
		let todayRun = 0;
		for (const row of rows) {
			const rowDate = formatLocalDate(new Date(row.reviewed_at));
			if (rowDate !== todayStr) continue;
			if (row.rating >= 3) {
				todayRun++;
				if (todayRun > todayBest) todayBest = todayRun;
			} else {
				todayRun = 0;
			}
		}

		return { current, todayBest, allTimeBest };
	}
}
