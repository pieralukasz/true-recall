import { notify } from "@true-recall/core/persistence/notification";
import type {
	BackupInterval,
	RetentionPolicy,
	TrueRecallSettings,
} from "@true-recall/core/types/settings.types";
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

export class BackgroundBackupManager {
	private backupService: BackupService;
	private config: BackgroundBackupConfig;

	// State tracking
	private intervalTimer: ReturnType<typeof setInterval> | null = null;
	private lastBackupTime: number | null = null;
	private reviewsSinceLastBackup = 0;
	private isBackupInProgress = false;
	private isDirty = false;
	private disposers: (() => void)[] = [];
	private consecutiveFailures = 0;
	private sessionStartBackupPath: string | null = null;
	private deps: BackgroundBackupDeps;

	constructor(
		backupService: BackupService,
		settings: TrueRecallSettings,
		deps: BackgroundBackupDeps,
	) {
		this.backupService = backupService;
		this.config = this.extractConfig(settings);
		this.deps = deps;
	}

	private extractConfig(settings: TrueRecallSettings): BackgroundBackupConfig {
		return {
			periodicBackupEnabled: settings.periodicBackupEnabled,
			backupIntervalMinutes: settings.backupIntervalMinutes,
			activityTriggeredBackup: settings.activityTriggeredBackup,
			reviewsBeforeBackup: settings.reviewsBeforeBackup,
			retentionPolicy: settings.retentionPolicy,
		};
	}

	start(): void {
		this.setupEventListeners();
		this.startPeriodicBackups();
	}

	stop(): void {
		this.stopPeriodicBackups();
		this.cleanupEventListeners();
	}

	updateConfig(settings: TrueRecallSettings): void {
		const newConfig = this.extractConfig(settings);
		const intervalChanged =
			newConfig.backupIntervalMinutes !== this.config.backupIntervalMinutes;
		const enabledChanged =
			newConfig.periodicBackupEnabled !== this.config.periodicBackupEnabled;

		this.config = newConfig;

		// Restart periodic backups if interval or enabled state changed
		if (intervalChanged || enabledChanged) {
			this.stopPeriodicBackups();
			if (this.config.periodicBackupEnabled) {
				this.startPeriodicBackups();
			}
		}
	}

	getStatus(): BackupStatus {
		return {
			lastBackupTime: this.lastBackupTime,
			nextScheduledBackup: this.calculateNextBackupTime(),
			reviewsSinceLastBackup: this.reviewsSinceLastBackup,
			isBackupInProgress: this.isBackupInProgress,
			sessionStartBackupPath: this.sessionStartBackupPath,
		};
	}

	async triggerBackup(force = false): Promise<boolean> {
		if (!force && !this.isDirty) {
			return false;
		}

		return this.performBackup();
	}

	markDirty(): void {
		this.isDirty = true;
	}

	private setupEventListeners(): void {
		this.disposers.push(
			this.deps.onCardsChanged(() => {
				this.isDirty = true;
			}),
			this.deps.onMutation((type) => {
				if (type === "reviewed") {
					this.reviewsSinceLastBackup++;
					this.checkActivityTrigger();
				}
			}),
		);
	}

	private cleanupEventListeners(): void {
		for (const dispose of this.disposers) {
			dispose();
		}
		this.disposers = [];
	}

	private startPeriodicBackups(): void {
		if (
			!this.config.periodicBackupEnabled ||
			this.config.backupIntervalMinutes === 0
		) {
			return;
		}

		const intervalMs = this.config.backupIntervalMinutes * 60 * 1000;

		this.intervalTimer = setInterval(() => {
			void this.performPeriodicBackup();
		}, intervalMs);
	}

	private stopPeriodicBackups(): void {
		if (this.intervalTimer) {
			clearInterval(this.intervalTimer);
			this.intervalTimer = null;
		}
	}

	private async performPeriodicBackup(): Promise<void> {
		if (!this.isDirty) {
			return;
		}

		await this.performBackup();
	}

	private checkActivityTrigger(): void {
		if (!this.config.activityTriggeredBackup) return;

		if (this.reviewsSinceLastBackup >= this.config.reviewsBeforeBackup) {
			void this.performBackup();
		}
	}

	private async performBackup(): Promise<boolean> {
		if (this.isBackupInProgress) {
			return false;
		}

		this.isBackupInProgress = true;

		try {
			const backupPath = await this.backupService.createBackup();
			// Capture the first backup of the session as the session start checkpoint.
			if (this.sessionStartBackupPath === null) {
				this.sessionStartBackupPath = backupPath;
			}
			this.lastBackupTime = Date.now();
			this.reviewsSinceLastBackup = 0;
			this.isDirty = false;
			this.consecutiveFailures = 0;

			// Apply smart retention
			await this.backupService.applySmartRetention(this.config.retentionPolicy);

			return true;
		} catch (error) {
			console.error("[True Recall] Background backup failed:", error);
			this.consecutiveFailures++;
			if (this.consecutiveFailures >= 3) {
				notify().warning(
					"Automatic backups are failing. Check console for details.",
				);
				this.consecutiveFailures = 0; // Reset to avoid spamming
			}
			return false;
		} finally {
			this.isBackupInProgress = false;
		}
	}

	private calculateNextBackupTime(): number | null {
		if (
			!this.config.periodicBackupEnabled ||
			this.config.backupIntervalMinutes === 0
		) {
			return null;
		}

		const intervalMs = this.config.backupIntervalMinutes * 60 * 1000;
		const baseTime = this.lastBackupTime || Date.now();
		return baseTime + intervalMs;
	}
}
