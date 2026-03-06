import type { SqliteDatabase } from "@features/core/persistence/sqlite/SqliteDatabase";

export interface IntegrityReport {
	orphanedCards: string[];
	orphanedNotes: string[];
	orphanedReviewLogs: string[];
	totalIssues: number;
}

export class IntegrityCheckService {
	constructor(private db: SqliteDatabase) {}

	check(): IntegrityReport {
		const orphanedCards = this.db
			.query<{ id: string }>(
				`SELECT c.id FROM cards c
				 LEFT JOIN notes n ON c.note_id = n.id
				 WHERE n.id IS NULL AND c.deleted_at IS NULL`,
			)
			.map((r) => r.id);

		const orphanedNotes = this.db
			.query<{ id: string }>(
				`SELECT n.id FROM notes n
				 LEFT JOIN note_types nt ON n.note_type_id = nt.id
				 WHERE nt.id IS NULL AND n.deleted_at IS NULL`,
			)
			.map((r) => r.id);

		const orphanedReviewLogs = this.db
			.query<{ id: string }>(
				`SELECT rl.id FROM review_log rl
				 LEFT JOIN cards c ON rl.card_id = c.id
				 WHERE c.id IS NULL AND rl.deleted_at IS NULL`,
			)
			.map((r) => r.id);

		return {
			orphanedCards,
			orphanedNotes,
			orphanedReviewLogs,
			totalIssues:
				orphanedCards.length + orphanedNotes.length + orphanedReviewLogs.length,
		};
	}

	repair(report: IntegrityReport): number {
		const now = Date.now();

		return this.db.transaction(() => {
			let fixed = 0;

			if (report.orphanedCards.length > 0) {
				for (const id of report.orphanedCards) {
					this.db.run(`UPDATE cards SET deleted_at = ? WHERE id = ?`, [
						now,
						id,
					]);
				}
				fixed += report.orphanedCards.length;
			}

			if (report.orphanedNotes.length > 0) {
				for (const id of report.orphanedNotes) {
					this.db.run(`UPDATE notes SET deleted_at = ? WHERE id = ?`, [
						now,
						id,
					]);
				}
				fixed += report.orphanedNotes.length;
			}

			if (report.orphanedReviewLogs.length > 0) {
				for (const id of report.orphanedReviewLogs) {
					this.db.run(`UPDATE review_log SET deleted_at = ? WHERE id = ?`, [
						now,
						id,
					]);
				}
				fixed += report.orphanedReviewLogs.length;
			}

			return fixed;
		});
	}

	/**
	 * Run check + repair on first load only (idempotent via meta key).
	 * Returns number of issues fixed, or 0 if already checked.
	 */
	checkAndRepairOnce(): number {
		const row = this.db.get<{ value: string }>(
			`SELECT value FROM meta WHERE key = 'integrity_checked'`,
		);
		if (row?.value === "1") return 0;

		const report = this.check();
		let fixed = 0;
		if (report.totalIssues > 0) {
			fixed = this.repair(report);
			console.log(
				`[True Recall] Integrity check: fixed ${fixed} orphaned records`,
			);
		}

		this.db.run(
			`INSERT OR REPLACE INTO meta (key, value) VALUES ('integrity_checked', '1')`,
		);
		return fixed;
	}
}
