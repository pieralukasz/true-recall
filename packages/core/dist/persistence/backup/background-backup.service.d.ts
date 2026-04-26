import type { BackupInterval, RetentionPolicy, TrueRecallSettings } from "@true-recall/core/types/settings.types";
import type { BackupService } from "./backup.service";
export interface BackgroundBackupConfig {
    periodicBackupEnabled: boolean;
    backupIntervalMinutes: BackupInterval;
    activityTriggeredBackup: boolean;
    reviewsBeforeBackup: number;
    retentionPolicy: RetentionPolicy;
}
export interface BackupStatus {
    lastBackupTime: number | null;
    nextScheduledBackup: number | null;
    reviewsSinceLastBackup: number;
    isBackupInProgress: boolean;
    sessionStartBackupPath: string | null;
}
export interface BackgroundBackupDeps {
    /** Called to subscribe to card-store changes. Returns a disposer. */
    onCardsChanged: (cb: () => void) => () => void;
    /** Called to subscribe to mutation events. Returns a disposer. */
    onMutation: (cb: (type: string) => void) => () => void;
}
export declare class BackgroundBackupManager {
    private backupService;
    private config;
    private intervalTimer;
    private lastBackupTime;
    private reviewsSinceLastBackup;
    private isBackupInProgress;
    private isDirty;
    private disposers;
    private consecutiveFailures;
    private sessionStartBackupPath;
    private deps;
    constructor(backupService: BackupService, settings: TrueRecallSettings, deps: BackgroundBackupDeps);
    private extractConfig;
    start(): void;
    stop(): void;
    updateConfig(settings: TrueRecallSettings): void;
    getStatus(): BackupStatus;
    triggerBackup(force?: boolean): Promise<boolean>;
    markDirty(): void;
    private setupEventListeners;
    private cleanupEventListeners;
    private startPeriodicBackups;
    private stopPeriodicBackups;
    private performPeriodicBackup;
    private checkActivityTrigger;
    private performBackup;
    private calculateNextBackupTime;
}
