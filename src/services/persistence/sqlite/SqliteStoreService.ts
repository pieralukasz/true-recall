/**
 * SQLite Store Service
 * High-performance storage for FSRS card data using sql.js
 *
 * Refactored to use domain modules (CardActions, StatsActions, ProjectActions, BrowserActions)
 * instead of individual repository classes. This reduces boilerplate and improves maintainability.
 *
 * The facade pattern is preserved but simplified - domain modules are exposed directly
 * for new code, while backward compatibility methods delegate to the appropriate module.
 */
import { App, normalizePath, Notice } from "obsidian";
import type {
    FSRSCardData,
    CardReviewLogEntry,
    ExtendedDailyStats,
    SourceNoteInfo,
    CardMaturityBreakdown,
    CardsCreatedVsReviewedEntry,
    CardImageRef,
    ProjectInfo,
} from "../../../types";
import { SqliteDatabase } from "./SqliteDatabase";
import { SqliteSchemaManager } from "./SqliteSchemaManager";
import { CardActions, StatsActions, ProjectActions, BrowserActions } from "./modules";
import { DB_FOLDER, DB_FILE, SAVE_DEBOUNCE_MS } from "./sqlite.types";

/**
 * SQLite-based storage service for FSRS card data
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

    // ===== Card Operations (delegate to CardActions) =====

    get(cardId: string): FSRSCardData | undefined {
        return this.cards.get(cardId);
    }

    set(cardId: string, data: FSRSCardData): void {
        this.cards.set(cardId, data);
    }

    delete(cardId: string): void {
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

    updateCardContent(cardId: string, question: string, answer: string): void {
        this.cards.updateCardContent(cardId, question, answer);
    }

    getCardsBySourceUid(sourceUid: string): FSRSCardData[] {
        return this.cards.getCardsBySourceUid(sourceUid);
    }

    getCardsWithContent(): FSRSCardData[] {
        return this.cards.getCardsWithContent();
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

    // ===== Orphaned Cards Operations =====

    getOrphanedCards(): FSRSCardData[] {
        return this.cards.getOrphanedCards();
    }

    updateCardSourceUid(cardId: string, sourceUid: string): void {
        this.cards.updateCardSourceUid(cardId, sourceUid);
    }

    /**
     * Check if a card with the given question already exists
     */
    getCardIdByQuestion(question: string): string | undefined {
        return this.cards.getCardIdByQuestion(question);
    }

    // ===== Source Notes Operations (delegate to ProjectActions) =====

    upsertSourceNote(info: SourceNoteInfo): void {
        this.projects.upsertSourceNote(info);
    }

    getSourceNote(uid: string): SourceNoteInfo | null {
        return this.projects.getSourceNote(uid);
    }

    getSourceNoteByPath(notePath: string): SourceNoteInfo | null {
        return this.projects.getSourceNoteByPath(notePath);
    }

    getAllSourceNotes(): SourceNoteInfo[] {
        return this.projects.getAllSourceNotes();
    }

    updateSourceNotePath(uid: string, newPath: string, newName?: string): void {
        this.projects.updateSourceNotePath(uid, newPath, newName);
    }

    deleteSourceNote(uid: string, detachCards = true): void {
        this.projects.deleteSourceNote(uid, detachCards);
    }

    // ===== Review Log & Daily Stats (delegate to StatsActions) =====

    addReviewLog(
        cardId: string,
        rating: number,
        scheduledDays: number,
        elapsedDays: number,
        state: number,
        timeSpentMs: number
    ): void {
        this.stats.addReviewLog(cardId, rating, scheduledDays, elapsedDays, state, timeSpentMs);
    }

    getCardReviewHistory(cardId: string, limit = 20): CardReviewLogEntry[] {
        return this.stats.getCardReviewHistory(cardId, limit);
    }

    getDailyStats(date: string): ExtendedDailyStats | null {
        return this.stats.getDailyStats(date);
    }

    updateDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
        this.stats.updateDailyStats(date, stats);
    }

    decrementDailyStats(date: string, stats: Partial<ExtendedDailyStats>): void {
        this.stats.decrementDailyStats(date, stats);
    }

    recordReviewedCard(date: string, cardId: string): void {
        this.stats.recordReviewedCard(date, cardId);
    }

    getReviewedCardIds(date: string): string[] {
        return this.stats.getReviewedCardIds(date);
    }

    removeReviewedCard(date: string, cardId: string): void {
        this.stats.removeReviewedCard(date, cardId);
    }

    getAllDailyStats(): Record<string, ExtendedDailyStats> {
        return this.stats.getAllDailyStats();
    }

    getAllDailyStatsSummary(): Record<string, ExtendedDailyStats> {
        return this.stats.getAllDailyStatsSummary();
    }

    // ===== Aggregations (delegate to StatsActions) =====

    getCardMaturityBreakdown(): CardMaturityBreakdown {
        return this.stats.getCardMaturityBreakdown();
    }

    getDueCardsByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        return this.stats.getDueCardsByDate(startDate, endDate);
    }

    getCardsCreatedByDate(startDate: string, endDate: string): { date: string; count: number }[] {
        return this.stats.getCardsCreatedByDate(startDate, endDate);
    }

    getCardsCreatedOnDate(date: string): string[] {
        return this.stats.getCardsCreatedOnDate(date);
    }

    getCardsCreatedVsReviewed(startDate: string, endDate: string): CardsCreatedVsReviewedEntry[] {
        return this.stats.getCardsCreatedVsReviewed(startDate, endDate);
    }

    // ===== Image Refs (delegate to ProjectActions) =====

    getImageRefsByCardId(cardId: string): CardImageRef[] {
        return this.projects.getImageRefsByCardId(cardId);
    }

    getCardsByImagePath(imagePath: string): CardImageRef[] {
        return this.projects.getCardsByImagePath(imagePath);
    }

    updateImagePath(oldPath: string, newPath: string): void {
        this.projects.updateImagePath(oldPath, newPath);
    }

    syncCardImageRefs(cardId: string, questionRefs: string[], answerRefs: string[]): void {
        this.projects.syncCardImageRefs(cardId, questionRefs, answerRefs);
    }

    deleteCardImageRefs(cardId: string): void {
        this.projects.deleteCardImageRefs(cardId);
    }

    // ===== Projects (delegate to ProjectActions) =====

    createProject(name: string): string {
        return this.projects.createProject(name);
    }

    getProjectByName(name: string): ProjectInfo | null {
        return this.projects.getProjectByName(name);
    }

    getProjectById(id: string): ProjectInfo | null {
        return this.projects.getProjectById(id);
    }

    getAllProjects(): ProjectInfo[] {
        return this.projects.getAllProjects();
    }

    renameProject(id: string, newName: string): void {
        this.projects.renameProject(id, newName);
    }

    deleteProject(id: string): void {
        this.projects.deleteProject(id);
    }

    syncNoteProjects(sourceUid: string, projectNames: string[]): void {
        this.projects.syncNoteProjects(sourceUid, projectNames);
    }

    getProjectsForNote(sourceUid: string): ProjectInfo[] {
        return this.projects.getProjectsForNote(sourceUid);
    }

    getProjectNamesForNote(sourceUid: string): string[] {
        return this.projects.getProjectNamesForNote(sourceUid);
    }

    getNotesInProject(projectId: string): string[] {
        return this.projects.getNotesInProject(projectId);
    }

    addProjectToNote(sourceUid: string, projectName: string): void {
        this.projects.addProjectToNote(sourceUid, projectName);
    }

    removeProjectFromNote(sourceUid: string, projectId: string): void {
        this.projects.removeProjectFromNote(sourceUid, projectId);
    }

    getProjectStats(): ProjectInfo[] {
        return this.projects.getProjectStats();
    }

    getOrphanedSourceNotes(): { uid: string; noteName: string; notePath: string }[] {
        return this.projects.getOrphanedSourceNotes();
    }

    deleteEmptyProjects(): number {
        return this.projects.deleteEmptyProjects();
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
            await this.flush();
        }, SAVE_DEBOUNCE_MS);
    }

    async flush(): Promise<void> {
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
        await this.flush();
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
