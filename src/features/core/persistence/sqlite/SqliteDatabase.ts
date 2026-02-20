import type { App } from "obsidian";
import type { BindParams, DatabaseLike, DatabaseLoadResult } from "./loader";
import { loadDatabase } from "./loader";

export class SqliteDatabase {
	private db: DatabaseLike | null = null;

	constructor(
		private app: App,
		private onDirty: () => void,
	) {}

	async init(existingData: Uint8Array | null): Promise<void> {
		const result: DatabaseLoadResult = await loadDatabase(
			this.app,
			existingData,
		);
		this.db = result.db;
	}

	/**
	 * Execute a query and return all rows as typed objects
	 * Automatically maps column names to object properties
	 *
	 * @example
	 * const cards = db.query<CardType>("SELECT * FROM cards WHERE state = ?", [2]);
	 */
	query<T extends object>(sql: string, params: BindParams = []): T[] {
		if (!this.db) throw new Error("Database not initialized");

		const result = this.db.exec(sql, params);
		if (result.length === 0) return [];

		const first = result[0];
		if (!first) return [];
		const { columns, values } = first;
		return values.map((row) => {
			const obj: Record<string, unknown> = {};
			columns.forEach((col, i) => {
				obj[col] = row[i];
			});
			return obj as T;
		});
	}

	/**
	 * Execute a query and return the first row or null
	 *
	 * @example
	 * const card = db.get<CardType>("SELECT * FROM cards WHERE id = ?", [cardId]);
	 */
	get<T extends object>(sql: string, params: BindParams = []): T | null {
		const results = this.query<T>(sql, params);
		return results[0] || null;
	}

	/**
	 * Execute a write operation and mark database as dirty
	 *
	 * @example
	 * db.run("INSERT INTO cards (id, question) VALUES (?, ?)", [id, question]);
	 */
	run(sql: string, params: BindParams = []): void {
		if (!this.db) throw new Error("Database not initialized");

		this.db.run(sql, params);
		this.onDirty();
	}

	/**
	 * Execute a function within a database transaction
	 * Provides atomicity - either all operations succeed or none do
	 *
	 * @example
	 * db.transaction(() => {
	 *     db.run("DELETE FROM cards WHERE id = ?", [cardId]);
	 *     db.run("DELETE FROM review_log WHERE card_id = ?", [cardId]);
	 * });
	 */
	transaction<T>(fn: () => T): T {
		if (!this.db) throw new Error("Database not initialized");

		try {
			this.db.run("BEGIN TRANSACTION");
			const result = fn();
			this.db.run("COMMIT");
			this.onDirty();
			return result;
		} catch (e) {
			this.db.run("ROLLBACK");
			throw e;
		}
	}

	/**
	 * Get the number of rows modified by the last INSERT/UPDATE/DELETE
	 */
	getRowsModified(): number {
		if (!this.db) return 0;
		return this.db.getRowsModified();
	}

	/**
	 * Access to the raw database instance for advanced operations
	 * Use sparingly - prefer query/get/run helpers
	 */
	get raw(): DatabaseLike {
		if (!this.db) throw new Error("Database not initialized");
		return this.db;
	}

	export(): Uint8Array {
		if (!this.db) throw new Error("Database not initialized");
		return this.db.export();
	}

	close(): void {
		this.db?.close();
		this.db = null;
	}

	isReady(): boolean {
		return this.db !== null;
	}
}
