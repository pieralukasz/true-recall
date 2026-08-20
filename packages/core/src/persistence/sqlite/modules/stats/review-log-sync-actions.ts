import type { SqliteDatabase } from "../../SqliteDatabase";
import type { ReviewLogForSync } from "./review-log-actions";

/** Structurally matches FsrsReplayService's ReplayLogEntry. */
export interface ReviewLogReplayRow {
	id: string;
	reviewedAt: string;
	rating: number;
	presetName: string | null;
	deviceId: string | null;
	reviewKind: string | null;
	deletedAt: number | null;
}

export class ReviewLogSyncActions {
	constructor(private db: SqliteDatabase) {}

	/** Full review history of one card, in replay shape (tombstones included). */
	getReplayLogsForCard(cardId: string): ReviewLogReplayRow[] {
		return this.db.query<ReviewLogReplayRow>(
			`
            SELECT
                id,
                reviewed_at as reviewedAt,
                rating,
                preset_name as presetName,
                device_id as deviceId,
                review_kind as reviewKind,
                deleted_at as deletedAt
            FROM review_log
            WHERE card_id = ?
        `,
			[cardId],
		);
	}

	/**
	 * Move all review history from one card id to another (duplicate merge).
	 * Bumps updated_at so the reassignment propagates to other devices.
	 */
	reassignCardReviews(fromCardId: string, toCardId: string): void {
		this.db.run(
			`UPDATE review_log SET card_id = ?, updated_at = ? WHERE card_id = ?`,
			[toCardId, Date.now(), fromCardId],
		);
	}

	/** Cards this device reviewed (non-preview) after the given watermark. */
	getReviewedCardIdsSince(timestamp: number): string[] {
		return this.db
			.query<{ cardId: string }>(
				`
            SELECT DISTINCT card_id as cardId
            FROM review_log
            WHERE updated_at > ?
              AND deleted_at IS NULL
              AND (review_kind IS NULL OR review_kind != 'preview')
        `,
				[timestamp],
			)
			.map((row) => row.cardId);
	}

	getModifiedReviewLogSince(timestamp: number): ReviewLogForSync[] {
		return this.db.query<ReviewLogForSync>(
			`
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
                deleted_at as deletedAt,
                preset_name as presetName,
                device_id as deviceId,
                review_kind as reviewKind
            FROM review_log
            WHERE updated_at > ?
        `,
			[timestamp],
		);
	}

	upsertReviewLogFromRemote(data: ReviewLogForSync): boolean {
		// LWW: skip if local version is newer or equal
		const existing = this.db.get<{ updated_at: number }>(
			`SELECT updated_at FROM review_log WHERE id = ?`,
			[data.id],
		);
		if (existing && existing.updated_at >= (data.updatedAt ?? 0)) {
			return false;
		}

		this.db.run(
			`
            INSERT OR REPLACE INTO review_log (
                id, card_id, reviewed_at, rating, scheduled_days,
                elapsed_days, state, time_spent_ms, updated_at,
                deleted_at, preset_name, device_id, review_kind
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
			// `?? null` binds: rows from an older remote schema can be missing
			// columns entirely, and undefined cannot bind.
			[
				data.id,
				data.cardId,
				data.reviewedAt,
				data.rating,
				data.scheduledDays,
				data.elapsedDays,
				data.state,
				data.timeSpentMs,
				data.updatedAt,
				data.deletedAt ?? null,
				data.presetName ?? null,
				data.deviceId ?? null,
				data.reviewKind ?? null,
			],
		);
		return true;
	}

	getReviewLogForSync(id: string): ReviewLogForSync | null {
		return this.db.get<ReviewLogForSync>(
			`
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
                deleted_at as deletedAt,
                preset_name as presetName,
                device_id as deviceId,
                review_kind as reviewKind
            FROM review_log WHERE id = ?
        `,
			[id],
		);
	}

	deleteAllReviewLogForSync(): void {
		this.db.run(`DELETE FROM review_log`);
	}

	getReviewDataForOptimization(presetName?: string): {
		cardId: string;
		reviewedAt: number;
		rating: number;
		scheduledDays: number;
		elapsedDays: number;
		state: number;
		stability: number;
		difficulty: number;
	}[] {
		const filterByPreset = presetName !== undefined;
		const isDefault = presetName === "Default";

		const rows = this.db.query<{
			cardId: string;
			reviewedAt: string;
			rating: number;
			scheduledDays: number;
			elapsedDays: number;
			state: number;
			stability: number;
			difficulty: number;
		}>(
			`
            SELECT
                r.card_id as cardId,
                r.reviewed_at as reviewedAt,
                r.rating,
                r.scheduled_days as scheduledDays,
                r.elapsed_days as elapsedDays,
                r.state,
                c.stability,
                c.difficulty
            FROM review_log r
            JOIN cards c ON r.card_id = c.id
            WHERE r.deleted_at IS NULL
              AND c.deleted_at IS NULL
              AND (? = 0
                   OR r.preset_name = ?
                   OR (? = 1 AND r.preset_name IS NULL))
            ORDER BY r.reviewed_at ASC
        `,
			[filterByPreset ? 1 : 0, presetName ?? null, isDefault ? 1 : 0],
		);

		return rows.map(
			(row: {
				cardId: string;
				reviewedAt: string;
				rating: number;
				scheduledDays: number;
				elapsedDays: number;
				state: number;
				stability: number;
				difficulty: number;
			}) => ({
				...row,
				reviewedAt: new Date(row.reviewedAt).getTime(),
			}),
		);
	}
}
