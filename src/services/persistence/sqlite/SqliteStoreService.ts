/**
 * SQLite Store Service
 * High-performance storage for FSRS card data using sql.js
 *
 * This is a facade that delegates to specialized repositories:
 * - SqliteCardRepository: Card CRUD operations
 * - SqliteSourceNotesRepo: Source note operations
 * - SqliteDailyStatsRepo: Daily stats and review log
 * - SqliteAggregations: Aggregate queries
 * - SqliteSchemaManager: Schema and migrations
 */
import { App, normalizePath } from "obsidian";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type {
    FSRSCardData,
    CardReviewLogEntry,
    ExtendedDailyStats,
    StoreSyncedEvent,
    SourceNoteInfo,
    CardMaturityBreakdown,
    CardImageRef,
    ProjectInfo,
} from "../../../types";
import { getEventBus } from "../../core/event-bus.service";
import { DB_FOLDER, DB_FILE, SAVE_DEBOUNCE_MS, getQueryResult } from "./sqlite.types";
import { SqliteSchemaManager } from "./SqliteSchemaManager";
import { SqliteCardRepository } from "./SqliteCardRepository";
import { SqliteSourceNotesRepo } from "./SqliteSourceNotesRepo";
import { SqliteDailyStatsRepo } from "./SqliteDailyStatsRepo";
import { SqliteAggregations } from "./SqliteAggregations";
import { SqliteImageRefsRepo } from "./SqliteImageRefsRepo";
import { SqliteProjectsRepo } from "./SqliteProjectsRepo";

/**
 * SQLite-based storage service for FSRS card data
 */
export class SqliteStoreService {
    private app: App;
    private db: Database | null = null;
    private SQL: SqlJsStatic | null = null;
    private isLoaded = false;
    private isDirty = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    // Repositories
    private cardRepo: SqliteCardRepository | null = null;
    private sourceNotesRepo: SqliteSourceNotesRepo | null = null;
    private dailyStatsRepo: SqliteDailyStatsRepo | null = null;
    private aggregations: SqliteAggregations | null = null;
    private imageRefsRepo: SqliteImageRefsRepo | null = null;
    private projectsRepo: SqliteProjectsRepo | null = null;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Initialize the SQLite database
     */
    async load(): Promise<void> {
        if (this.isLoaded) return;

        this.SQL = await initSqlJs({
            locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
        });

        const dbPath = this.getDbPath();
        const existingData = await this.loadFromFile(dbPath);

        if (existingData) {
            this.db = new this.SQL.Database(existingData);
            const schemaManager = new SqliteSchemaManager(this.db, () => this.markDirty());
            schemaManager.runMigrations();
        } else {
            this.db = new this.SQL.Database();
            const schemaManager = new SqliteSchemaManager(this.db, () => this.markDirty());
            schemaManager.createTables();
            this.isDirty = true;
        }

        // Initialize repositories
        const onDataChange = () => this.markDirty();
        this.cardRepo = new SqliteCardRepository(this.db, onDataChange);
        this.sourceNotesRepo = new SqliteSourceNotesRepo(this.db, onDataChange);
        this.dailyStatsRepo = new SqliteDailyStatsRepo(this.db, onDataChange);
        this.aggregations = new SqliteAggregations(this.db);
        this.imageRefsRepo = new SqliteImageRefsRepo(this.db, onDataChange);
        this.projectsRepo = new SqliteProjectsRepo(this.db, onDataChange);

        this.isLoaded = true;
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

    // ===== Aggregations (delegate to SqliteAggregations) =====

    getCardMaturityBreakdown(): CardMaturityBreakdown {
        return this.aggregations?.getCardMaturityBreakdown() ?? {
            new: 0, learning: 0, young: 0, mature: 0, suspended: 0, buried: 0
        };
    }

    getDueCardsByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        return this.aggregations?.getDueCardsByDate(startDate, endDate) ?? [];
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

    createProject(name: string): number {
        return this.projectsRepo?.createProject(name) ?? -1;
    }

    getProjectByName(name: string): ProjectInfo | null {
        return this.projectsRepo?.getProjectByName(name) ?? null;
    }

    getProjectById(id: number): ProjectInfo | null {
        return this.projectsRepo?.getProjectById(id) ?? null;
    }

    getAllProjects(): ProjectInfo[] {
        return this.projectsRepo?.getAllProjects() ?? [];
    }

    renameProject(id: number, newName: string): void {
        this.projectsRepo?.renameProject(id, newName);
    }

    deleteProject(id: number): void {
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

    getNotesInProject(projectId: number): string[] {
        return this.projectsRepo?.getNotesInProject(projectId) ?? [];
    }

    addProjectToNote(sourceUid: string, projectName: string): void {
        this.projectsRepo?.addProjectToNote(sourceUid, projectName);
    }

    removeProjectFromNote(sourceUid: string, projectId: number): void {
        this.projectsRepo?.removeProjectFromNote(sourceUid, projectId);
    }

    getProjectStats(): ProjectInfo[] {
        return this.projectsRepo?.getProjectStats() ?? [];
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
     */
    async mergeFromDisk(): Promise<{ merged: number; conflicts: number }> {
        if (!this.db || !this.SQL || !this.cardRepo) {
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

            const diskDb = new this.SQL.Database(diskData);
            const diskResult = diskDb.exec(`SELECT * FROM cards`);
            const diskCards = getQueryResult(diskResult);

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
    getDatabase(): Database | null {
        return this.db;
    }

    /**
     * Get aggregations service for extended statistics
     */
    getAggregations(): SqliteAggregations | null {
        return this.aggregations;
    }
}
