/**
 * Session Persistence Service
 * Handles persistent storage of daily review statistics in .shadow-anki/stats.json
 */
import { App, TFile, normalizePath } from "obsidian";
import type { PersistentStatsData, PersistentDailyStats } from "../types";

const STATS_FOLDER = ".shadow-anki";
const STATS_FILE = "stats.json";
const CURRENT_VERSION = 1;

/**
 * Service for persisting review session data across plugin restarts
 * Stores data in vault for sync compatibility with mobile
 */
export class SessionPersistenceService {
    private app: App;
    private statsPath: string;
    private cache: PersistentStatsData | null = null;

    constructor(app: App) {
        this.app = app;
        this.statsPath = normalizePath(`${STATS_FOLDER}/${STATS_FILE}`);
    }

    /**
     * Get today's date in YYYY-MM-DD format
     */
    getTodayKey(): string {
        return new Date().toISOString().split("T")[0] ?? "";
    }

    /**
     * Load stats from file (with caching)
     */
    async loadStats(): Promise<PersistentStatsData> {
        if (this.cache) {
            return this.cache;
        }

        try {
            const file = this.app.vault.getAbstractFileByPath(this.statsPath);
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                this.cache = JSON.parse(content) as PersistentStatsData;
                return this.cache;
            }
        } catch (error) {
            console.error("[SessionPersistence] Error loading stats:", error);
        }

        // Return default stats
        return this.createDefaultStats();
    }

    /**
     * Save stats to file
     */
    async saveStats(stats: PersistentStatsData): Promise<void> {
        stats.lastUpdated = new Date().toISOString();
        this.cache = stats;

        await this.ensureFolderExists();

        const content = JSON.stringify(stats, null, 2);
        const file = this.app.vault.getAbstractFileByPath(this.statsPath);

        if (file instanceof TFile) {
            await this.app.vault.modify(file, content);
        } else {
            await this.app.vault.create(this.statsPath, content);
        }
    }

    /**
     * Get today's stats (creates empty if not exists)
     */
    async getTodayStats(): Promise<PersistentDailyStats> {
        const stats = await this.loadStats();
        const today = this.getTodayKey();

        if (!stats.daily[today]) {
            stats.daily[today] = this.createEmptyDayStats(today);
        }

        return stats.daily[today]!;
    }

    /**
     * Record a card review
     */
    async recordReview(cardId: string, isNewCard: boolean, durationMs: number): Promise<void> {
        const stats = await this.loadStats();
        const today = this.getTodayKey();

        if (!stats.daily[today]) {
            stats.daily[today] = this.createEmptyDayStats(today);
        }

        const dayStats = stats.daily[today]!;

        // Add card ID if not already reviewed
        if (!dayStats.reviewedCardIds.includes(cardId)) {
            dayStats.reviewedCardIds.push(cardId);
        }

        dayStats.reviewsCompleted++;
        dayStats.totalTimeMs += durationMs;

        if (isNewCard) {
            dayStats.newCardsStudied++;
        }

        await this.saveStats(stats);
    }

    /**
     * Get set of cards reviewed today (for queue exclusion)
     */
    async getReviewedToday(): Promise<Set<string>> {
        const dayStats = await this.getTodayStats();
        return new Set(dayStats.reviewedCardIds);
    }

    /**
     * Get count of new cards studied today
     */
    async getNewCardsStudiedToday(): Promise<number> {
        const dayStats = await this.getTodayStats();
        return dayStats.newCardsStudied;
    }

    /**
     * Clean up old stats (keep last 30 days)
     */
    async cleanupOldStats(): Promise<void> {
        const stats = await this.loadStats();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const cutoff = cutoffDate.toISOString().split("T")[0] ?? "";

        const newDaily: Record<string, PersistentDailyStats> = {};
        for (const [date, dayStats] of Object.entries(stats.daily)) {
            if (date >= cutoff) {
                newDaily[date] = dayStats;
            }
        }

        stats.daily = newDaily;
        await this.saveStats(stats);
    }

    /**
     * Invalidate cache (call after external changes)
     */
    invalidateCache(): void {
        this.cache = null;
    }

    // ===== Private helpers =====

    private createDefaultStats(): PersistentStatsData {
        return {
            version: CURRENT_VERSION,
            lastUpdated: new Date().toISOString(),
            daily: {},
        };
    }

    private createEmptyDayStats(date: string): PersistentDailyStats {
        return {
            date,
            reviewedCardIds: [],
            newCardsStudied: 0,
            reviewsCompleted: 0,
            totalTimeMs: 0,
        };
    }

    private async ensureFolderExists(): Promise<void> {
        const folderPath = normalizePath(STATS_FOLDER);
        const folder = this.app.vault.getAbstractFileByPath(folderPath);

        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
    }
}
