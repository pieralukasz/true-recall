/**
 * High-performance storage for FSRS card data using sql.js.
 * Uses domain modules: store.cards.*, store.stats.*, store.browser.*
 */
import { App, normalizePath } from "obsidian";
import { notify, NOTIFICATION_DURATION } from "../../ui/notification.service";
import type { FSRSCardData } from "../../../types";
import { SqliteDatabase } from "./SqliteDatabase";
import { SqliteSchemaManager } from "./SqliteSchemaManager";
import { CardActions, StatsActions } from "./modules";
import { DB_FOLDER, SAVE_DEBOUNCE_MS, getDeviceDbFilename } from "./sqlite.types";

export class SqliteStoreService {
    private app: App;
    private deviceId: string;
    private db: SqliteDatabase;
    private isLoaded = false;
    private isDirty = false;
    private saveInProgress = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    // Domain modules - public for direct access
    public readonly cards: CardActions;
    public readonly stats: StatsActions;

    constructor(app: App, deviceId: string) {
        this.app = app;
        this.deviceId = deviceId;
        this.db = new SqliteDatabase(app, () => this.markDirty());

        // Initialize domain modules
        this.cards = new CardActions(this.db);
        this.stats = new StatsActions(this.db);
    }

    getDeviceId(): string {
        return this.deviceId;
    }

    async load(): Promise<void> {
        if (this.isLoaded) return;

        const dbPath = this.getDbPath();

        // Load existing data - errors are now thrown instead of returning null
        let existingData: Uint8Array | null = null;
        try {
            existingData = await this.loadFromFile(dbPath);
        } catch (error) {
            // File exists but cannot be read - CRITICAL ERROR
            console.error("[True Recall] Database load failed:", error);
            notify().error(
                "True Recall: Cannot load database. Please restore from backup (Settings → Data & Backup → Restore).",
                undefined,
                NOTIFICATION_DURATION.PERSIST  // Don't auto-hide
            );
            throw error;  // Don't continue with empty database!
        }

        // Initialize database with sql.js
        await this.db.init(existingData);

        console.debug("[True Recall] Using sql.js for local storage");

        // Schema setup
        const schemaManager = new SqliteSchemaManager(this.db.raw, () => this.markDirty());
        if (existingData) {
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

    get(cardId: string): FSRSCardData | undefined {
        return this.cards.get(cardId);
    }

    set(cardId: string, data: FSRSCardData): void {
        this.cards.set(cardId, data);
    }

    delete(cardId: string): void {
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Wrapper maintains backward compatibility
        this.cards.delete(cardId);
    }

    has(cardId: string): boolean {
        return this.cards.has(cardId);
    }

    keys(): string[] {
        return this.cards.keys();
    }

    getAll(): FSRSCardData[] {
        return this.cards.getAll();
    }

    size(): number {
        return this.cards.size();
    }

    getByIds(cardIds: string[]): FSRSCardData[] {
        return this.cards.getByIds(cardIds);
    }

    getCardsWithContent(): FSRSCardData[] {
        return this.cards.getCardsWithContent();
    }

    getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
        return this.cards.getCardsBySourceUid(sourceUid);
    }

    hasCardContent(cardId: string): boolean {
        return this.cards.hasCardContent(cardId);
    }

    hasAnyCardContent(): boolean {
        return this.cards.hasAnyCardContent();
    }

    getCardsWithContentCount(): number {
        return this.cards.getCardsWithContentCount();
    }

    getOrphanedCards(): FSRSCardData[] {
        return this.cards.getOrphanedCards();
    }

    async flush(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        await this.doFlush();
    }

    private getDbPath(): string {
        const filename = getDeviceDbFilename(this.deviceId);
        return normalizePath(`${DB_FOLDER}/${filename}`);
    }

    private async loadFromFile(path: string): Promise<Uint8Array | null> {
        const exists = await this.app.vault.adapter.exists(path);
        if (!exists) {
            console.debug("[True Recall] Database file not found - will create new");
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
            console.error("[True Recall] CRITICAL: Failed to load existing database:", error);
            throw new Error(`Cannot load database: ${error instanceof Error ? error.message : String(error)}`);
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

        this.saveTimer = setTimeout(() => {
            void this.doFlush();
        }, SAVE_DEBOUNCE_MS);
    }

    private async doFlush(): Promise<boolean> {
        if (!this.db.isReady() || !this.isDirty) return true; // Nothing to save = success

        // Prevent concurrent saves
        if (this.saveInProgress) {
            // Another save is running, schedule a retry after it completes
            this.scheduleSave();
            return true; // Will be saved by scheduled retry
        }

        this.saveInProgress = true;
        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 100;

        try {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
                    return true; // Success
                } catch (error) {
                    console.error(`[True Recall] Failed to save database (attempt ${attempt}/${MAX_RETRIES}):`, error);

                    if (attempt < MAX_RETRIES) {
                        // Exponential backoff: 100ms, 200ms, 400ms...
                        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    } else {
                        // Final failure - notify user, keep isDirty=true for retry
                        notify().error(
                            "Failed to save database after multiple attempts. Your recent changes may not be saved.",
                            NOTIFICATION_DURATION.LONG
                        );
                        return false; // Caller can react to failure
                    }
                }
            }
        } finally {
            this.saveInProgress = false;
        }
        return false; // Should not reach here
    }

    async saveNow(): Promise<boolean> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        return this.doFlush();
    }

    async close(): Promise<void> {
        await this.saveNow();
        this.db.close();
        this.isLoaded = false;
    }

    transaction<T>(fn: () => T): T {
        return this.db.transaction(fn);
    }

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

    getDatabase() {
        return this.db.raw;
    }

    getCards(): FSRSCardData[] {
        return this.cards.getAll();
    }

    getDueCardsByDateRange(startDate: string, endDate: string): FSRSCardData[] {
        return this.cards.getDueCardsByDateRange(startDate, endDate);
    }

    async updateCardDue(cardId: string, newDue: string): Promise<void> {
        this.cards.updateCardDue(cardId, newDue);
    }

    async updateCardScheduling(
        cardId: string,
        data: { due: string; scheduledDays: number }
    ): Promise<void> {
        this.cards.updateCardScheduling(cardId, data);
    }

    getReviewDataForOptimization() {
        return this.stats.getReviewDataForOptimization();
    }

    getReviewsForRetention(startDate: string, endDate: string) {
        return this.stats.getReviewsForRetention(startDate, endDate);
    }
}
