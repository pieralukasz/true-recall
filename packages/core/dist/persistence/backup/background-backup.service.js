import { __awaiter } from "tslib";
import { notify } from "@true-recall/core/persistence/notification";
export class BackgroundBackupManager {
    constructor(backupService, settings, deps) {
        // State tracking
        this.intervalTimer = null;
        this.lastBackupTime = null;
        this.reviewsSinceLastBackup = 0;
        this.isBackupInProgress = false;
        this.isDirty = false;
        this.disposers = [];
        this.consecutiveFailures = 0;
        this.sessionStartBackupPath = null;
        this.backupService = backupService;
        this.config = this.extractConfig(settings);
        this.deps = deps;
    }
    extractConfig(settings) {
        return {
            periodicBackupEnabled: settings.periodicBackupEnabled,
            backupIntervalMinutes: settings.backupIntervalMinutes,
            activityTriggeredBackup: settings.activityTriggeredBackup,
            reviewsBeforeBackup: settings.reviewsBeforeBackup,
            retentionPolicy: settings.retentionPolicy,
        };
    }
    start() {
        this.setupEventListeners();
        this.startPeriodicBackups();
    }
    stop() {
        this.stopPeriodicBackups();
        this.cleanupEventListeners();
    }
    updateConfig(settings) {
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
    getStatus() {
        return {
            lastBackupTime: this.lastBackupTime,
            nextScheduledBackup: this.calculateNextBackupTime(),
            reviewsSinceLastBackup: this.reviewsSinceLastBackup,
            isBackupInProgress: this.isBackupInProgress,
            sessionStartBackupPath: this.sessionStartBackupPath,
        };
    }
    triggerBackup() {
        return __awaiter(this, arguments, void 0, function* (force = false) {
            if (!force && !this.isDirty) {
                return false;
            }
            return this.performBackup();
        });
    }
    markDirty() {
        this.isDirty = true;
    }
    setupEventListeners() {
        this.disposers.push(this.deps.onCardsChanged(() => {
            this.isDirty = true;
        }), this.deps.onMutation((type) => {
            if (type === "reviewed") {
                this.reviewsSinceLastBackup++;
                this.checkActivityTrigger();
            }
        }));
    }
    cleanupEventListeners() {
        for (const dispose of this.disposers) {
            dispose();
        }
        this.disposers = [];
    }
    startPeriodicBackups() {
        if (!this.config.periodicBackupEnabled ||
            this.config.backupIntervalMinutes === 0) {
            return;
        }
        const intervalMs = this.config.backupIntervalMinutes * 60 * 1000;
        this.intervalTimer = setInterval(() => {
            void this.performPeriodicBackup();
        }, intervalMs);
    }
    stopPeriodicBackups() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }
    performPeriodicBackup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isDirty) {
                return;
            }
            yield this.performBackup();
        });
    }
    checkActivityTrigger() {
        if (!this.config.activityTriggeredBackup)
            return;
        if (this.reviewsSinceLastBackup >= this.config.reviewsBeforeBackup) {
            void this.performBackup();
        }
    }
    performBackup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isBackupInProgress) {
                return false;
            }
            this.isBackupInProgress = true;
            try {
                const backupPath = yield this.backupService.createBackup();
                // Capture the first backup of the session as the session start checkpoint.
                if (this.sessionStartBackupPath === null) {
                    this.sessionStartBackupPath = backupPath;
                }
                this.lastBackupTime = Date.now();
                this.reviewsSinceLastBackup = 0;
                this.isDirty = false;
                this.consecutiveFailures = 0;
                // Apply smart retention
                yield this.backupService.applySmartRetention(this.config.retentionPolicy);
                return true;
            }
            catch (error) {
                console.error("[True Recall] Background backup failed:", error);
                this.consecutiveFailures++;
                if (this.consecutiveFailures >= 3) {
                    notify().warning("Automatic backups are failing. Check console for details.");
                    this.consecutiveFailures = 0; // Reset to avoid spamming
                }
                return false;
            }
            finally {
                this.isBackupInProgress = false;
            }
        });
    }
    calculateNextBackupTime() {
        if (!this.config.periodicBackupEnabled ||
            this.config.backupIntervalMinutes === 0) {
            return null;
        }
        const intervalMs = this.config.backupIntervalMinutes * 60 * 1000;
        const baseTime = this.lastBackupTime || Date.now();
        return baseTime + intervalMs;
    }
}
