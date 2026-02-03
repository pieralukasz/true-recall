/**
 * Background Backup Manager Service
 *
 * Handles automatic periodic backups with smart retention policy.
 * Features:
 * - Configurable backup intervals (15min, 30min, 1hr, 2hr, 4hr)
 * - Activity-based triggers (backup after N reviews)
 * - Dirty flag tracking (only backup when changes exist)
 * - Multi-tier retention (hourly/daily/weekly)
 * - Non-blocking async operation
 */
import type { App } from "obsidian";
import type { BackupService } from "./backup.service";
import type { TrueRecallSettings, RetentionPolicy, BackupInterval } from "../../types/settings.types";
import { getEventBus } from "../core/event-bus.service";

/**
 * Configuration extracted from plugin settings
 */
export interface BackgroundBackupConfig {
    periodicBackupEnabled: boolean;
    backupIntervalMinutes: BackupInterval;
    activityTriggeredBackup: boolean;
    reviewsBeforeBackup: number;
    retentionPolicy: RetentionPolicy;
}

/**
 * Current backup status for UI display
 */
export interface BackupStatus {
    lastBackupTime: number | null;
    nextScheduledBackup: number | null;
    reviewsSinceLastBackup: number;
    isBackupInProgress: boolean;
}

/**
 * Manages automatic background backups
 */
export class BackgroundBackupManager {
    private app: App;
    private backupService: BackupService;
    private config: BackgroundBackupConfig;

    // State tracking
    private intervalTimer: ReturnType<typeof setInterval> | null = null;
    private lastBackupTime: number | null = null;
    private reviewsSinceLastBackup = 0;
    private isBackupInProgress = false;
    private isDirty = false;
    private unsubscribeEvents: (() => void)[] = [];

    constructor(
        app: App,
        backupService: BackupService,
        settings: TrueRecallSettings
    ) {
        this.app = app;
        this.backupService = backupService;
        this.config = this.extractConfig(settings);
    }

    /**
     * Extract backup config from full settings
     */
    private extractConfig(settings: TrueRecallSettings): BackgroundBackupConfig {
        return {
            periodicBackupEnabled: settings.periodicBackupEnabled,
            backupIntervalMinutes: settings.backupIntervalMinutes,
            activityTriggeredBackup: settings.activityTriggeredBackup,
            reviewsBeforeBackup: settings.reviewsBeforeBackup,
            retentionPolicy: settings.retentionPolicy,
        };
    }

    /**
     * Start the background backup system
     */
    start(): void {
        this.setupEventListeners();
        this.startPeriodicBackups();
        console.debug("[True Recall] Background backup manager started");
    }

    /**
     * Stop all background backup operations
     */
    stop(): void {
        this.stopPeriodicBackups();
        this.cleanupEventListeners();
        console.debug("[True Recall] Background backup manager stopped");
    }

    /**
     * Update configuration and restart if needed
     */
    updateConfig(settings: TrueRecallSettings): void {
        const newConfig = this.extractConfig(settings);
        const intervalChanged = newConfig.backupIntervalMinutes !== this.config.backupIntervalMinutes;
        const enabledChanged = newConfig.periodicBackupEnabled !== this.config.periodicBackupEnabled;

        this.config = newConfig;

        // Restart periodic backups if interval or enabled state changed
        if (intervalChanged || enabledChanged) {
            this.stopPeriodicBackups();
            if (this.config.periodicBackupEnabled) {
                this.startPeriodicBackups();
            }
        }
    }

    /**
     * Get current backup status for UI display
     */
    getStatus(): BackupStatus {
        return {
            lastBackupTime: this.lastBackupTime,
            nextScheduledBackup: this.calculateNextBackupTime(),
            reviewsSinceLastBackup: this.reviewsSinceLastBackup,
            isBackupInProgress: this.isBackupInProgress,
        };
    }

    /**
     * Manually trigger a backup (bypasses dirty flag if force=true)
     */
    async triggerBackup(force = false): Promise<boolean> {
        if (!force && !this.isDirty) {
            console.debug("[True Recall] Skipping backup - no changes since last backup");
            return false;
        }

        return this.performBackup();
    }

    /**
     * Mark data as changed (should be called after any modification)
     */
    markDirty(): void {
        this.isDirty = true;
    }

    // ===== Private Methods =====

    private setupEventListeners(): void {
        const eventBus = getEventBus();

        // Track reviews for activity-based backup
        const unsubReview = eventBus.on("card:reviewed", () => {
            this.isDirty = true;
            this.reviewsSinceLastBackup++;
            this.checkActivityTrigger();
        });
        this.unsubscribeEvents.push(unsubReview);

        // Track card changes
        const unsubAdded = eventBus.on("card:added", () => { this.isDirty = true; });
        const unsubUpdated = eventBus.on("card:updated", () => { this.isDirty = true; });
        const unsubRemoved = eventBus.on("card:removed", () => { this.isDirty = true; });
        const unsubBulk = eventBus.on("cards:bulk-change", () => { this.isDirty = true; });

        this.unsubscribeEvents.push(unsubAdded, unsubUpdated, unsubRemoved, unsubBulk);
    }

    private cleanupEventListeners(): void {
        this.unsubscribeEvents.forEach(unsub => unsub());
        this.unsubscribeEvents = [];
    }

    private startPeriodicBackups(): void {
        if (!this.config.periodicBackupEnabled || this.config.backupIntervalMinutes === 0) {
            return;
        }

        const intervalMs = this.config.backupIntervalMinutes * 60 * 1000;

        this.intervalTimer = setInterval(() => {
            void this.performPeriodicBackup();
        }, intervalMs);

        console.debug(`[True Recall] Periodic backups scheduled every ${this.config.backupIntervalMinutes} minutes`);
    }

    private stopPeriodicBackups(): void {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    private async performPeriodicBackup(): Promise<void> {
        if (!this.isDirty) {
            console.debug("[True Recall] Skipping periodic backup - no changes");
            return;
        }

        await this.performBackup();
    }

    private checkActivityTrigger(): void {
        if (!this.config.activityTriggeredBackup) return;

        if (this.reviewsSinceLastBackup >= this.config.reviewsBeforeBackup) {
            console.debug(`[True Recall] Activity trigger: ${this.reviewsSinceLastBackup} reviews since last backup`);
            void this.performBackup();
        }
    }

    private async performBackup(): Promise<boolean> {
        if (this.isBackupInProgress) {
            console.debug("[True Recall] Backup already in progress, skipping");
            return false;
        }

        this.isBackupInProgress = true;

        try {
            // Create backup
            await this.backupService.createBackup();
            this.lastBackupTime = Date.now();
            this.reviewsSinceLastBackup = 0;
            this.isDirty = false;

            // Apply smart retention
            await this.backupService.applySmartRetention(this.config.retentionPolicy);

            console.debug("[True Recall] Background backup completed successfully");
            return true;
        } catch (error) {
            console.error("[True Recall] Background backup failed:", error);
            return false;
        } finally {
            this.isBackupInProgress = false;
        }
    }

    private calculateNextBackupTime(): number | null {
        if (!this.config.periodicBackupEnabled || this.config.backupIntervalMinutes === 0) {
            return null;
        }

        const intervalMs = this.config.backupIntervalMinutes * 60 * 1000;
        const baseTime = this.lastBackupTime || Date.now();
        return baseTime + intervalMs;
    }
}
