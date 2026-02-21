/**
 * Test Database Setup
 * In-memory SQLite database for fast, isolated tests
 */
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { State } from "ts-fsrs";
import type { FSRSCardData } from "../../../../../src/shared/types";
import type {
	DatabaseLike,
	QueryExecResult,
	BindParams,
} from "../../../../../src/features/core/persistence/sqlite/loader";
import { CardActions } from "../../../../../src/features/core/persistence/sqlite/modules/CardActions";
import { StatsActions } from "../../../../../src/features/core/persistence/sqlite/modules/StatsActions";

/**
 * Wrapper that makes sql.js Database compatible with DatabaseLike interface
 * Uses prepared statements for proper parameter binding
 */
class TestSqlJsWrapper implements DatabaseLike {
	constructor(private sqlDb: SqlJsDatabase) {}

	exec(sql: string, params?: BindParams): QueryExecResult[] {
		if (!params || params.length === 0) {
			return this.sqlDb.exec(sql) as QueryExecResult[];
		}

		// Use prepared statement for parameter binding
		const stmt = this.sqlDb.prepare(sql);
		stmt.bind(params);

		const results: QueryExecResult[] = [];
		const columns: string[] = stmt.getColumnNames();
		const values: (string | number | null | Uint8Array)[][] = [];

		while (stmt.step()) {
			values.push(stmt.get() as (string | number | null | Uint8Array)[]);
		}

		if (columns.length > 0) {
			results.push({ columns, values });
		}

		stmt.free();
		return results;
	}

	run(sql: string, params?: BindParams): void {
		this.sqlDb.run(sql, params);
	}

	export(): Uint8Array {
		return this.sqlDb.export();
	}

	close(): void {
		this.sqlDb.close();
	}

	getRowsModified(): number {
		return this.sqlDb.getRowsModified();
	}
}

/**
 * Minimal SqliteDatabase interface for testing
 * Only includes methods used by CardActions
 */
export class TestSqliteDatabase {
	private db: DatabaseLike | null = null;
	private dirtyCallback: () => void;

	constructor(onDirty?: () => void) {
		this.dirtyCallback = onDirty ?? (() => {});
	}

	async init(): Promise<void> {
		const SQL = await initSqlJs();
		this.db = new TestSqlJsWrapper(new SQL.Database());
		this.createSchema();
	}

	private createSchema(): void {
		if (!this.db) throw new Error("Database not initialized");

		this.db.run(`
			-- Cards table with FSRS scheduling data + content
			CREATE TABLE IF NOT EXISTS cards (
				id TEXT PRIMARY KEY NOT NULL,
				due TEXT NOT NULL,
				stability REAL DEFAULT 0,
				difficulty REAL DEFAULT 0,
				reps INTEGER DEFAULT 0,
				lapses INTEGER DEFAULT 0,
				state INTEGER DEFAULT 0,
				last_review TEXT,
				scheduled_days INTEGER DEFAULT 0,
				learning_step INTEGER DEFAULT 0,
				suspended INTEGER DEFAULT 0,
				buried_until TEXT,
				created_at INTEGER,
				updated_at INTEGER,
				deleted_at INTEGER DEFAULT NULL,
				question TEXT,
				answer TEXT,
				source_uid TEXT,
				card_type TEXT NOT NULL DEFAULT 'basic',
				cloze_template TEXT,
				cloze_index INTEGER,
				reverse_of TEXT,
				io_image_path TEXT,
				io_regions_json TEXT,
				io_group_key TEXT,
				io_parent_id TEXT,
				created_via TEXT DEFAULT 'manual',
				source_text TEXT
			);

			-- Indexes
			CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
			CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
			CREATE INDEX IF NOT EXISTS idx_cards_suspended ON cards(suspended);
			CREATE INDEX IF NOT EXISTS idx_cards_source_uid ON cards(source_uid);
			CREATE INDEX IF NOT EXISTS idx_cards_deleted ON cards(deleted_at);
			CREATE INDEX IF NOT EXISTS idx_cards_card_type ON cards(card_type);
			CREATE INDEX IF NOT EXISTS idx_cards_reverse_of ON cards(reverse_of);

			-- Review log
			CREATE TABLE IF NOT EXISTS review_log (
				id TEXT PRIMARY KEY NOT NULL,
				card_id TEXT NOT NULL,
				reviewed_at TEXT NOT NULL,
				rating INTEGER NOT NULL,
				scheduled_days INTEGER,
				elapsed_days INTEGER,
				state INTEGER,
				time_spent_ms INTEGER,
				updated_at INTEGER,
				deleted_at INTEGER DEFAULT NULL,
				preset_name TEXT,
				FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_revlog_card ON review_log(card_id);
			CREATE INDEX IF NOT EXISTS idx_revlog_deleted ON review_log(deleted_at);
			CREATE INDEX IF NOT EXISTS idx_revlog_preset ON review_log(preset_name);

			-- Metadata
			CREATE TABLE IF NOT EXISTS meta (
				key TEXT PRIMARY KEY NOT NULL,
				value TEXT
			);

			INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '22');
		`);
	}

	query<T extends object>(sql: string, params: BindParams = []): T[] {
		if (!this.db) throw new Error("Database not initialized");

		const result = this.db.exec(sql, params);
		if (result.length === 0) return [];

		const { columns, values } = result[0]!;
		return values.map((row) => {
			const obj: Record<string, unknown> = {};
			columns.forEach((col, i) => {
				obj[col] = row[i];
			});
			return obj as T;
		});
	}

	get<T extends object>(sql: string, params: BindParams = []): T | null {
		const results = this.query<T>(sql, params);
		return results[0] || null;
	}

	run(sql: string, params: BindParams = []): void {
		if (!this.db) throw new Error("Database not initialized");
		this.db.run(sql, params);
		this.dirtyCallback();
	}

	runMany(statements: [string, BindParams][]): void {
		if (!this.db) throw new Error("Database not initialized");
		for (const [sql, params] of statements) {
			this.db.run(sql, params);
		}
		this.dirtyCallback();
	}

	transaction<T>(fn: () => T): T {
		if (!this.db) throw new Error("Database not initialized");

		try {
			this.db.run("BEGIN TRANSACTION");
			const result = fn();
			this.db.run("COMMIT");
			this.dirtyCallback();
			return result;
		} catch (e) {
			this.db.run("ROLLBACK");
			throw e;
		}
	}

	getRowsModified(): number {
		if (!this.db) return 0;
		return this.db.getRowsModified();
	}

	get raw(): DatabaseLike {
		if (!this.db) throw new Error("Database not initialized");
		return this.db;
	}

	isReady(): boolean {
		return this.db !== null;
	}

	close(): void {
		this.db?.close();
		this.db = null;
	}
}

/**
 * Test context with database and actions
 */
export interface TestContext {
	db: TestSqliteDatabase;
	cards: CardActions;
	stats: StatsActions;
	close: () => void;
}

/**
 * Create test database context
 * Use in beforeEach to get fresh database for each test
 */
export async function createTestContext(): Promise<TestContext> {
	const db = new TestSqliteDatabase();
	await db.init();

	const cards = new CardActions(db as never);
	const stats = new StatsActions(db as never);

	return {
		db,
		cards,
		stats,
		close: () => db.close(),
	};
}

/**
 * Create a test card with sensible defaults
 */
export function createTestCard(overrides: Partial<FSRSCardData> = {}): FSRSCardData {
	const now = new Date();
	const id = overrides.id ?? `card-${Math.random().toString(36).slice(2, 10)}`;

	return {
		id,
		due: overrides.due ?? now.toISOString(),
		stability: overrides.stability ?? 0,
		difficulty: overrides.difficulty ?? 0,
		reps: overrides.reps ?? 0,
		lapses: overrides.lapses ?? 0,
		state: overrides.state ?? State.New,
		lastReview: overrides.lastReview ?? null,
		scheduledDays: overrides.scheduledDays ?? 0,
		learningStep: overrides.learningStep ?? 0,
		suspended: overrides.suspended ?? false,
		buriedUntil: overrides.buriedUntil,
		createdAt: overrides.createdAt ?? Date.now(),
		question: overrides.question ?? `Question for ${id}`,
		answer: overrides.answer ?? `Answer for ${id}`,
		sourceUid: overrides.sourceUid,
		sourceText: overrides.sourceText,
	};
}

/**
 * Create a card linked to a source note
 */
export function createCardWithSource(
	sourceUid: string,
	overrides: Partial<FSRSCardData> = {}
): FSRSCardData {
	return createTestCard({
		...overrides,
		sourceUid,
	});
}

/**
 * Create an orphaned card (no source_uid)
 */
export function createOrphanedCard(overrides: Partial<FSRSCardData> = {}): FSRSCardData {
	return createTestCard({
		...overrides,
		sourceUid: undefined,
	});
}

/**
 * Insert a card directly into the database (bypasses CardRepository)
 */
export function insertCardDirect(cards: CardActions, card: FSRSCardData): void {
	cards.set(card.id, card);
}

/**
 * Get raw card data from database (for verification)
 */
export function getRawCard(
	db: TestSqliteDatabase,
	cardId: string
): Record<string, unknown> | null {
	return db.get<Record<string, unknown>>(
		`SELECT * FROM cards WHERE id = ?`,
		[cardId]
	);
}
