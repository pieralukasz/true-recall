/**
 * SQLite Store Service
 * High-performance storage for FSRS card data using sql.js or CR-SQLite
 *
 * This is a facade that delegates to specialized repositories:
 * - SqliteCardRepository: Card CRUD operations
 * - SqliteSourceNotesRepo: Source note operations
 * - SqliteDailyStatsRepo: Daily stats and review log
 * - SqliteAggregations: Aggregate queries
 * - SqliteSchemaManager: Schema and migrations
 *
 * Supports CR-SQLite for CRDT-based cross-device synchronization.
 * Falls back to sql.js if CR-SQLite fails to load.
 */
import { App, normalizePath } from "obsidian";
import type {
    FSRSCardData,
    CardReviewLogEntry,
    ExtendedDailyStats,
    StoreSyncedEvent,
    SourceNoteInfo,
    CardMaturityBreakdown,
    CardsCreatedVsReviewedEntry,
    CardImageRef,
    ProjectInfo,
} from "../../../types";
import { getEventBus } from "../../core/event-bus.service";
import {
    loadDatabase,
    isCrSqliteAvailable,
    initializeCrrs,
    type DatabaseLike,
} from "../crsqlite";
import { DB_FOLDER, DB_FILE, SAVE_DEBOUNCE_MS, getQueryResult } from "./sqlite.types";
import { SqliteSchemaManager } from "./SqliteSchemaManager";
import { SqliteCardRepository } from "./SqliteCardRepository";
import { SqliteSourceNotesRepo } from "./SqliteSourceNotesRepo";
import { SqliteDailyStatsRepo } from "./SqliteDailyStatsRepo";
import { SqliteAggregations } from "./SqliteAggregations";
import { SqliteImageRefsRepo } from "./SqliteImageRefsRepo";
import { SqliteProjectsRepo } from "./SqliteProjectsRepo";
import { SqliteBrowserQueries } from "./SqliteBrowserQueries";

/**
 * SQLite-based storage service for FSRS card data
 * Supports both sql.js and CR-SQLite backends
 */
export class SqliteStoreService {
    private app: App;
    private db: DatabaseLike | null = null;
    private isLoaded = false;
    private isDirty = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    // CR-SQLite sync metadata
    private useCrSqlite = false;
    private _siteId: string | null = null;

    // Repositories
    private cardRepo: SqliteCardRepository | null = null;
    private sourceNotesRepo: SqliteSourceNotesRepo | null = null;
    private dailyStatsRepo: SqliteDailyStatsRepo | null = null;
    private aggregations: SqliteAggregations | null = null;
    private imageRefsRepo: SqliteImageRefsRepo | null = null;
    private projectsRepo: SqliteProjectsRepo | null = null;
    private browserQueries: SqliteBrowserQueries | null = null;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Initialize the SQLite database
     * Attempts to use CR-SQLite for sync capabilities, falls back to sql.js
     */
    async load(): Promise<void> {
        if (this.isLoaded) return;

        const dbPath = this.getDbPath();
        const existingData = await this.loadFromFile(dbPath);

        // Load database with CR-SQLite or sql.js fallback
        const loadResult = await loadDatabase(this.app, existingData);
        this.db = loadResult.db;
        this.useCrSqlite = loadResult.isCrSqlite;
        this._siteId = loadResult.siteId;

        if (this.useCrSqlite) {
            console.log(`[Episteme] Using CR-SQLite (site_id: ${this._siteId?.substring(0, 8)}...)`);
        } else {
            console.log("[Episteme] Using sql.js fallback (sync disabled)");
        }

        // Schema setup
        const schemaManager = new SqliteSchemaManager(this.db, () => this.markDirty());
        if (existingData) {
            schemaManager.runMigrations();
        } else {
            schemaManager.createTables();
            this.isDirty = true;
        }

        // Initialize CRRs if using CR-SQLite
        if (this.useCrSqlite) {
            try {
                initializeCrrs(this.db);
            } catch (e) {
                console.warn("[Episteme] Failed to initialize CRRs:", e);
            }
        }

        // Initialize repositories
        const onDataChange = () => this.markDirty();
        this.cardRepo = new SqliteCardRepository(this.db, onDataChange);
        this.sourceNotesRepo = new SqliteSourceNotesRepo(this.db, onDataChange);
        this.dailyStatsRepo = new SqliteDailyStatsRepo(this.db, onDataChange);
        this.aggregations = new SqliteAggregations(this.db);
        this.imageRefsRepo = new SqliteImageRefsRepo(this.db, onDataChange);
        this.projectsRepo = new SqliteProjectsRepo(this.db, onDataChange);
        this.browserQueries = new SqliteBrowserQueries(this.db, onDataChange);

        this.isLoaded = true;
    }

    /**
     * Check if sync is enabled
     * With Server-Side Merge, sync is always available (no CR-SQLite needed on client)
     */
    isSyncEnabled(): boolean {
        return true;
    }

    /**
     * Get the site ID for this database instance (for sync)
     * Returns null if CR-SQLite is not enabled
     */
    getSiteId(): string | null {
        return this._siteId;
    }

    isReady(): boolean {
        return this.isLoaded && this.db !== null;
    }

    // ===== Card Operations (delegate to SqliteCardRepository) =====

    get(cardId: string): FSRSCardData | undefined {
        return this.cardRepo?.get(cardId);
    }

    set(cardId: string, data: FSRSCardData): void {
        this.cardRepo?.set(cardId, data);
    }

    delete(cardId: string): void {
        this.cardRepo?.delete(cardId);
    }

    has(cardId: string): boolean {
        return this.cardRepo?.has(cardId) ?? false;
    }

    keys(): string[] {
        return this.cardRepo?.keys() ?? [];
    }

    getAll(): FSRSCardData[] {
        return this.cardRepo?.getAll() ?? [];
    }

    size(): number {
        return this.cardRepo?.size() ?? 0;
    }

    updateCardContent(cardId: string, question: string, answer: string): void {
        this.cardRepo?.updateCardContent(cardId, question, answer);
    }

    getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
        return this.cardRepo?.getCardsBySourceUid(sourceUid) ?? [];
    }

    getCardsWithContent(): FSRSCardData[] {
        return this.cardRepo?.getCardsWithContent() ?? [];
    }

    hasCardContent(cardId: string): boolean {
        return this.cardRepo?.hasCardContent(cardId) ?? false;
    }

    hasAnyCardContent(): boolean {
        return this.cardRepo?.hasAnyCardContent() ?? false;
    }

    getCardsWithContentCount(): number {
        return this.cardRepo?.getCardsWithContentCount() ?? 0;
    }

    // ===== Orphaned Cards Operations =====

    getOrphanedCards(): FSRSCardData[] {
        return this.cardRepo?.getOrphanedCards() ?? [];
    }

    updateCardSourceUid(cardId: string, sourceUid: string): void {
        this.cardRepo?.updateCardSourceUid(cardId, sourceUid);
    }

    /**
     * Check if a card with the given question already exists
     */
    getCardIdByQuestion(question: string): string | undefined {
        return this.cardRepo?.getCardIdByQuestion(question);
    }

    // ===== Source Notes Operations (delegate to SqliteSourceNotesRepo) =====

    upsertSourceNote(info: SourceNoteInfo): void {
        this.sourceNotesRepo?.upsert(info);
    }

    getSourceNote(uid: string): SourceNoteInfo | null {
        return this.sourceNotesRepo?.get(uid) ?? null;
    }

    getSourceNoteByPath(notePath: string): SourceNoteInfo | null {
        return this.sourceNotesRepo?.getByPath(notePath) ?? null;
    }

    getAllSourceNotes(): SourceNoteInfo[] {
        return this.sourceNotesRepo?.getAll() ?? [];
    }

    updateSourceNotePath(uid: string, newPath: string, newName?: string): void {
        this.sourceNotesRepo?.updatePath(uid, newPath, newName);
    }

    deleteSourceNote(uid: string, detachCards = true): void {
        this.sourceNotesRepo?.delete(uid, detachCards);
    }

    // ===== Review Log & Daily Stats (delegate to SqliteDailyStatsRepo) =====

    addReviewLog(
        cardId: string,
        rating: number,
        scheduledDays: number,
        elapsedDays: number,
        state: number,
        timeSpentMs: number
    ): void {
        this.dailyStatsRepo?.addReviewLog(cardId, rating, scheduledDays, elapsedDays, state, timeSpentMs);
    }

    getCardReviewHistory(cardId: string, limit = 20): CardReviewLogEntry[] {
        return this.dailyStatsRepo?.getCardReviewHistory(cardId, limit) ?? [];
    }

    getDailyStats(date: string): ExtendedDailyStats | null {
        return this.dailyStatsRepo?.getDailyStats(date) ?? null;
    }

    updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
        this.dailyStatsRepo?.updateDailyStats(date, stats);
    }

    decrementDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
        this.dailyStatsRepo?.decrementDailyStats(date, stats);
    }

    recordReviewedCard(date: string, cardId: string): void {
        this.dailyStatsRepo?.recordReviewedCard(date, cardId);
    }

    getReviewedCardIds(date: string): string[] {
        return this.dailyStatsRepo?.getReviewedCardIds(date) ?? [];
    }

    removeReviewedCard(date: string, cardId: string): void {
        this.dailyStatsRepo?.removeReviewedCard(date, cardId);
    }

    getAllDailyStats(): Record<string, ExtendedDailyStats> {
        return this.dailyStatsRepo?.getAllDailyStats() ?? {};
    }

    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
        return this.dailyStatsRepo?.getAllDailyStatsSummary() ?? {};
    }

    // ===== Aggregations (delegate to SqliteAggregations) =====

    getCardMaturityBreakdown(): CardMaturityBreakdown {
        return this.aggregations?.getCardMaturityBreakdown() ?? {
            new: 0, learning: 0, young: 0, mature: 0, suspended: 0, buried: 0
        };
    }

    getDueCardsByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        return this.aggregations?.getDueCardsByDate(startDate, endDate) ?? [];
    }

    getCardsCreatedByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        return this.aggregations?.getCardsCreatedByDate(startDate, endDate) ?? [];
    }

    getCardsCreatedOnDate(date: string): string[] {
        return this.aggregations?.getCardsCreatedOnDate(date) ?? [];
    }

    getCardsCreatedVsReviewed(startDate: string, endDate: string): CardsCreatedVsReviewedEntry[] {
        return this.aggregations?.getCardsCreatedVsReviewed(startDate, endDate) ?? [];
    }

    // ===== Image Refs (delegate to SqliteImageRefsRepo) =====

    getImageRefsByCardId(cardId: string): CardImageRef[] {
        return this.imageRefsRepo?.getByCardId(cardId) ?? [];
    }

    getCardsByImagePath(imagePath: string): CardImageRef[] {
        return this.imageRefsRepo?.getByImagePath(imagePath) ?? [];
    }

    updateImagePath(oldPath: string, newPath: string): void {
        this.imageRefsRepo?.updateImagePath(oldPath, newPath);
    }

    syncCardImageRefs(cardId: string, questionRefs: string[], answerRefs: string[]): void {
        this.imageRefsRepo?.syncCardRefs(cardId, questionRefs, answerRefs);
    }

    deleteCardImageRefs(cardId: string): void {
        this.imageRefsRepo?.deleteByCardId(cardId);
    }

    // ===== Projects (delegate to SqliteProjectsRepo) =====

    createProject(name: string): string {
        return this.projectsRepo?.createProject(name) ?? "";
    }

    getProjectByName(name: string): ProjectInfo | null {
        return this.projectsRepo?.getProjectByName(name) ?? null;
    }

    getProjectById(id: string): ProjectInfo | null {
        return this.projectsRepo?.getProjectById(id) ?? null;
    }

    getAllProjects(): ProjectInfo[] {
        return this.projectsRepo?.getAllProjects() ?? [];
    }

    renameProject(id: string, newName: string): void {
        this.projectsRepo?.renameProject(id, newName);
    }

    deleteProject(id: string): void {
        this.projectsRepo?.deleteProject(id);
    }

    syncNoteProjects(sourceUid: string, projectNames: string[]): void {
        this.projectsRepo?.syncNoteProjects(sourceUid, projectNames);
    }

    getProjectsForNote(sourceUid: string): ProjectInfo[] {
        return this.projectsRepo?.getProjectsForNote(sourceUid) ?? [];
    }

    getProjectNamesForNote(sourceUid: string): string[] {
        return this.projectsRepo?.getProjectNamesForNote(sourceUid) ?? [];
    }

    getNotesInProject(projectId: string): string[] {
        return this.projectsRepo?.getNotesInProject(projectId) ?? [];
    }

    addProjectToNote(sourceUid: string, projectName: string): void {
        this.projectsRepo?.addProjectToNote(sourceUid, projectName);
    }

    removeProjectFromNote(sourceUid: string, projectId: string): void {
        this.projectsRepo?.removeProjectFromNote(sourceUid, projectId);
    }

    getProjectStats(): ProjectInfo[] {
        return this.projectsRepo?.getProjectStats() ?? [];
    }

    getOrphanedSourceNotes(): { uid: string; noteName: string; notePath: string }[] {
        return this.projectsRepo?.getOrphanedSourceNotes() ?? [];
    }

    deleteEmptyProjects(): number {
        return this.projectsRepo?.deleteEmptyProjects() ?? 0;
    }

    // ===== Persistence =====

    private getDbPath(): string {
        return normalizePath(`${DB_FOLDER}/${DB_FILE}`);
    }

    private async loadFromFile(path: string): Promise<Uint8Array | null> {
        try {
            const exists = await this.app.vault.adapter.exists(path);
            if (!exists) return null;

            const data = await this.app.vault.adapter.readBinary(path);
            return new Uint8Array(data);
        } catch (error) {
            console.warn("[Episteme] Failed to load database:", error);
            return null;
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
            await this.flush();
        }, SAVE_DEBOUNCE_MS);
    }

    async flush(): Promise<void> {
        if (!this.db || !this.isDirty) return;

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
        await this.flush();
    }

    async close(): Promise<void> {
        await this.saveNow();
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.isLoaded = false;
    }

    /**
     * Merge with data from disk (for sync conflict resolution)
     * Note: This is a legacy file-based sync method. When CR-SQLite is enabled,
     * use the CRDT-based sync instead (handled by CrSqliteSyncService).
     */
    async mergeFromDisk(): Promise<{ merged: number; conflicts: number }> {
        if (!this.db || !this.cardRepo) {
            return { merged: 0, conflicts: 0 };
        }

        // When CR-SQLite is enabled, skip file-based merge (CRDT handles sync)
        if (this.useCrSqlite) {
            console.log("[Episteme] CR-SQLite enabled - use CRDT sync instead of mergeFromDisk");
            return { merged: 0, conflicts: 0 };
        }

        let merged = 0;
        let conflicts = 0;

        try {
            const dbPath = this.getDbPath();
            const diskData = await this.loadFromFile(dbPath);

            if (!diskData) {
                return { merged, conflicts };
            }

            // Load disk database using the loader (will use sql.js since we're in fallback mode)
            const diskResult = await loadDatabase(this.app, diskData);
            const diskDb = diskResult.db;
            const diskQueryResult = diskDb.exec("SELECT * FROM cards");
            const diskCards = getQueryResult(diskQueryResult);

            if (!diskCards) {
                diskDb.close();
                return { merged, conflicts };
            }

            for (const diskRow of diskCards.values) {
                const id = diskRow[diskCards.columns.indexOf("id")] as string;
                const diskLastReview = diskRow[diskCards.columns.indexOf("last_review")] as string | null;

                const memCard = this.get(id);

                if (!memCard) {
                    const diskCard = this.cardRepo.rowToFSRSCardData(diskCards.columns, diskRow);
                    this.set(id, diskCard);
                    merged++;
                } else if (diskLastReview && memCard.lastReview) {
                    const diskTime = new Date(diskLastReview).getTime();
                    const memTime = new Date(memCard.lastReview).getTime();

                    if (diskTime > memTime) {
                        const diskCard = this.cardRepo.rowToFSRSCardData(diskCards.columns, diskRow);
                        this.set(id, diskCard);
                        conflicts++;
                    }
                } else if (diskLastReview && !memCard.lastReview) {
                    const diskCard = this.cardRepo.rowToFSRSCardData(diskCards.columns, diskRow);
                    this.set(id, diskCard);
                    conflicts++;
                }
            }

            diskDb.close();

            if (merged > 0 || conflicts > 0) {
                getEventBus().emit({
                    type: "store:synced",
                    merged,
                    conflicts,
                    timestamp: Date.now(),
                } as StoreSyncedEvent);
            }
        } catch (error) {
            console.warn("[Episteme] Failed to merge from disk:", error);
        }

        return { merged, conflicts };
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
        if (!this.db) {
            return { totalCards: 0, totalReviews: 0, dbSizeKB: 0, isLoaded: false };
        }

        const totalCards = this.size();
        const totalReviews = this.dailyStatsRepo?.getTotalReviewCount() ?? 0;
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
    getDatabase(): DatabaseLike | null {
        return this.db;
    }

    /**
     * Get aggregations service for extended statistics
     */
    getAggregations(): SqliteAggregations | null {
        return this.aggregations;
    }

    /**
     * Get browser queries service for browser view
     */
    getBrowserQueries(): SqliteBrowserQueries | null {
        return this.browserQueries;
    }
}
