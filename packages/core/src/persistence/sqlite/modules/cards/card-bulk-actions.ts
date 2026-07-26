import type { FSRSCardData } from "../../../../types";
import type { SqliteDatabase } from "../../SqliteDatabase";
import { sqlPlaceholders } from "../../sql-utils";

export class CardBulkActions {
	constructor(private db: SqliteDatabase) {}

	bulkSuspend(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = sqlPlaceholders(cardIds.length);
		const params = [Date.now(), ...cardIds] as [number, ...string[]];
		this.db.run(
			`UPDATE cards SET suspended = 1, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkUnsuspend(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = sqlPlaceholders(cardIds.length);
		const params = [Date.now(), ...cardIds] as [number, ...string[]];
		this.db.run(
			`UPDATE cards SET suspended = 0, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkBury(cardIds: string[], untilDate: string): number {
		if (cardIds.length === 0) return 0;
		const placeholders = sqlPlaceholders(cardIds.length);
		const params = [untilDate, Date.now(), ...cardIds] as [
			string,
			number,
			...string[],
		];
		this.db.run(
			`UPDATE cards SET buried_until = ?, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkUnbury(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = sqlPlaceholders(cardIds.length);
		const params = [Date.now(), ...cardIds] as [number, ...string[]];
		this.db.run(
			`UPDATE cards SET buried_until = NULL, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	bulkSoftDelete(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const now = Date.now();
		const placeholders = sqlPlaceholders(cardIds.length);
		this.db.transaction(() => {
			this.db.run(
				`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id IN (${placeholders})`,
				[now, now, ...cardIds],
			);
			this.db.run(
				`UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
				[now, now, ...cardIds],
			);
		});
		return cardIds.length;
	}

	bulkForget(cardIds: string[]): number {
		if (cardIds.length === 0) return 0;
		const placeholders = sqlPlaceholders(cardIds.length);
		const forgettableRows = this.db.query<{ id: string }>(
			`SELECT id FROM cards WHERE id IN (${placeholders}) AND state != 0`,
			cardIds,
		);
		const forgettableIds = forgettableRows.map((row: { id: string }) => row.id);
		if (forgettableIds.length === 0) return 0;
		const forgettablePlaceholders = sqlPlaceholders(forgettableIds.length);
		const now = new Date().toISOString();
		const nowMs = Date.now();
		let modified = 0;
		this.db.transaction(() => {
			this.db.run(
				`UPDATE cards SET
						state = 0, reps = 0, lapses = 0,
						stability = 0, difficulty = 0, scheduled_days = 0,
						learning_step = 0, due = ?, last_review = NULL,
						suspended = 0, buried_until = NULL, updated_at = ?
					WHERE id IN (${forgettablePlaceholders})`,
				[now, nowMs, ...forgettableIds],
			);
			modified = this.db.getRowsModified();
			this.db.run(
				`UPDATE review_log SET deleted_at = ?, updated_at = ? WHERE card_id IN (${forgettablePlaceholders})`,
				[nowMs, nowMs, ...forgettableIds],
			);
		});
		return modified;
	}

	bulkReschedule(cardIds: string[], dueDate: string): number {
		if (cardIds.length === 0) return 0;
		const placeholders = sqlPlaceholders(cardIds.length);
		const params = [dueDate, Date.now(), ...cardIds] as [
			string,
			number,
			...string[],
		];
		this.db.run(
			`UPDATE cards SET due = ?, updated_at = ? WHERE id IN (${placeholders})`,
			params,
		);
		return this.db.getRowsModified();
	}

	// Used by CardQueryActions.softDeleteIOFamily — needs access to query actions
	softDeleteIOFamily(
		parentId: string,
		getIOChildren: (parentId: string) => FSRSCardData[],
	): string[] {
		const children = getIOChildren(parentId);
		const allIds = [parentId, ...children.map((c) => c.id)];
		this.bulkSoftDelete(allIds);
		return allIds;
	}
}
