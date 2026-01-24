/**
 * SQLite Store Service
 * High-performance storage for FSRS card data using sql.js
 *
 * Refactored to use domain modules (CardActions, StatsActions, ProjectActions, BrowserActions).
 * All operations are now performed directly on the appropriate module:
 * - store.cards.* for card operations
 * - store.stats.* for review log and statistics
 * - store.projects.* for source notes, projects, and image references
 * - store.browser.* for browser view queries
 */
import { App, normalizePath, Notice } from "obsidian";
import type { FSRSCardData } from "../../../types";
import { SqliteDatabase } from "./SqliteDatabase";
import { SqliteSchemaManager } from "./SqliteSchemaManager";
import { CardActions, StatsActions, ProjectActions, BrowserActions } from "./modules";
import { DB_FOLDER, DB_FILE, SAVE_DEBOUNCE_MS } from "./sqlite.types";

/**
 * SQLite-based storage service for FSRS card data
 *
 * Domain modules are exposed directly for all operations:
 * - store.cards.get(id) - Get a card
 * - store.stats.getDailyStats(date) - Get daily stats
 * - store.projects.upsertSourceNote(info) - Upsert a source note
 * - store.browser.getAllCardsForBrowser() - Get all cards for browser view
 */
export class SqliteStoreService {
    private app: App;
    private db: SqliteDatabase;
    private isLoaded = false;
    private isDirty = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    // Domain modules - public for direct access
    public readonly cards: CardActions;
    public readonly stats: StatsActions;
    public readonly projects: ProjectActions;
    public readonly browser: BrowserActions;

    constructor(app: App) {
        this.app = app;
        this.db = new SqliteDatabase(app, () => this.markDirty());

        // Initialize domain modules
        this.cards = new CardActions(this.db);
        this.stats = new StatsActions(this.db);
        this.projects = new ProjectActions(this.db);
        this.browser = new BrowserActions(this.db);
    }

    /**
     * Initialize the SQLite database
     */
    async load(): Promise<void> {
        if (this.isLoaded) return;

        const dbPath = this.getDbPath();

        // Load existing data - errors are now thrown instead of returning null
        let existingData: Uint8Array | null = null;
        try {
            existingData = await this.loadFromFile(dbPath);
        } catch (error) {
            // File exists but cannot be read - CRITICAL ERROR
            console.error("[Episteme] Database load failed:", error);
            new Notice(
                "Episteme: Cannot load database. Please restore from backup (Settings → Data & Backup → Restore).",
                0  // Don't auto-hide
            );
            throw error;  // Don't continue with empty database!
        }

        // Initialize database with sql.js
        await this.db.init(existingData);

        console.log("[Episteme] Using sql.js for local storage");

        // Schema setup
        const schemaManager = new SqliteSchemaManager(this.db.raw, () => this.markDirty());
        if (existingData) {
            // Create pre-migration backup for safety
            const backupPath = normalizePath(`${DB_FOLDER}/episteme.db.pre-migration`);
            try {
                await this.app.vault.adapter.writeBinary(backupPath, existingData);
                console.log("[Episteme] Pre-migration backup created");
            } catch (e) {
                console.warn("[Episteme] Could not create pre-migration backup:", e);
            }

            schemaManager.runMigrations();
        } else {
            schemaManager.createTables();
            this.isDirty = true;
        }

        this.isLoaded = true;
    }

    isReady(): boolean {
        return this.isLoaded && this.db.isReady();
    }

    // ===== Core CardStore methods (delegates to cards module) =====

    /** Check if store is loaded and ready */
    get(cardId: string): FSRSCardData | undefined {
        return this.cards.get(cardId);
    }

    /** Set/update a card */
    set(cardId: string, data: FSRSCardData): void {
        this.cards.set(cardId, data);
    }

    /** Delete a card */
    delete(cardId: string): void {
        this.cards.delete(cardId);
    }

    /** Check if a card exists */
    has(cardId: string): boolean {
        return this.cards.has(cardId);
    }

    /** Get all card IDs */
    keys(): string[] {
        return this.cards.keys();
    }

    /** Get all cards */
    getAll(): FSRSCardData[] {
        return this.cards.getAll();
    }

    /** Get total card count */
    size(): number {
        return this.cards.size();
    }

    // ===== Content & Source Operations (delegates to cards module) =====

    /** Get all cards that have content */
    getCardsWithContent(): FSRSCardData[] {
        return this.cards.getCardsWithContent();
    }

    /** Get cards by source note UID */
    getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
        return this.cards.getCardsBySourceUid(sourceUid);
    }

    /** Check if card has content */
    hasCardContent(cardId: string): boolean {
        return this.cards.hasCardContent(cardId);
    }

    /** Check if any cards have content */
    hasAnyCardContent(): boolean {
        return this.cards.hasAnyCardContent();
    }

    /** Get count of cards with content */
    getCardsWithContentCount(): number {
        return this.cards.getCardsWithContentCount();
    }

    /** Get all orphaned cards */
    getOrphanedCards(): FSRSCardData[] {
        return this.cards.getOrphanedCards();
    }

    /** Flush pending changes to disk */
    async flush(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        await this.doFlush();
    }

    // ===== Persistence =====

    private getDbPath(): string {
        return normalizePath(`${DB_FOLDER}/${DB_FILE}`);
    }

    private async loadFromFile(path: string): Promise<Uint8Array | null> {
        const exists = await this.app.vault.adapter.exists(path);
        if (!exists) {
            console.log("[Episteme] Database file not found - will create new");
            return null;
        }

        // File exists - read errors are CRITICAL (don't treat as "new database")
        try {
            const data = await this.app.vault.adapter.readBinary(path);

            // Validate SQLite header: "SQLite format 3\0"
            if (data.byteLength < 100) {
                throw new Error(`Database file too small (${data.byteLength} bytes) - likely corrupted`);
            }

            const header = new TextDecoder().decode(new Uint8Array(data).slice(0, 16));
            if (!header.startsWith("SQLite format 3")) {
                throw new Error("Invalid SQLite header - file corrupted");
            }

            return new Uint8Array(data);
        } catch (error) {
            // DO NOT return null - this would create an empty database!
            console.error("[Episteme] CRITICAL: Failed to load existing database:", error);
            throw new Error(`Cannot load database: ${error instanceof Error ? error.message : error}`);
        }
    }

    private markDirty(): void {
        this.isDirty = true;
        this.scheduleSave();
    }

    private scheduleSave(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(async () => {
            await this.doFlush();
        }, SAVE_DEBOUNCE_MS);
    }

    private async doFlush(): Promise<void> {
        if (!this.db.isReady() || !this.isDirty) return;

        try {
            const data = this.db.export();
            const dbPath = this.getDbPath();

            const folderPath = normalizePath(DB_FOLDER);
            const folderExists = await this.app.vault.adapter.exists(folderPath);
            if (!folderExists) {
                await this.app.vault.adapter.mkdir(folderPath);
            }

            await this.app.vault.adapter.writeBinary(dbPath, data.buffer);
            this.isDirty = false;
        } catch (error) {
            console.error("[Episteme] Failed to save database:", error);
        }
    }

    async saveNow(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        await this.doFlush();
    }

    async close(): Promise<void> {
        await this.saveNow();
        this.db.close();
        this.isLoaded = false;
    }

    /**
     * Get database statistics
     */
    getStats(): {
        totalCards: number;
        totalReviews: number;
        dbSizeKB: number;
        isLoaded: boolean;
    } {
        if (!this.db.isReady()) {
            return { totalCards: 0, totalReviews: 0, dbSizeKB: 0, isLoaded: false };
        }

        const totalCards = this.size();
        const totalReviews = this.stats.getTotalReviewCount();
        const dbData = this.db.export();
        const dbSizeKB = Math.round(dbData.length / 1024);

        return {
            totalCards,
            totalReviews,
            dbSizeKB,
            isLoaded: this.isLoaded,
        };
    }

    /**
     * Get the raw database instance for advanced queries
     * Used by NLQueryService for AI-powered natural language queries
     */
    getDatabase() {
        return this.db.raw;
    }

    /**
     * Get aggregations service for extended statistics
     * @deprecated Use store.stats directly instead
     */
    getAggregations() {
        return this.stats;
    }

    /**
     * Get browser queries service for browser view
     * @deprecated Use store.browser directly instead
     */
    getBrowserQueries() {
        return this.browser;
    }
}
