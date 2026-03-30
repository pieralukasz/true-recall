import type { BackgroundBackupManager } from "@features/core/persistence/background-backup.service";
import type { BackupService } from "@features/core/persistence/backup.service";
import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import {
	decodeBackupToSqliteBytes,
	isSupportedBackupPath,
	sortBackupPathsNewest,
	toExactBackupBuffer,
} from "@features/core/persistence/sqlite/recovery.utils";
import {
	DB_FOLDER,
	getDeviceDbFilename,
} from "@features/core/persistence/sqlite/sqlite.types";
import { RestoreBackupModal } from "@features/integration/modals/RestoreBackupModal";
import {
	NOTIFICATION_DURATION,
	notify,
} from "@shared/services/notification.service";
import { type App, normalizePath } from "obsidian";

export class BackupRecoveryManager {
	lastAutoRecoveryBackupPath: string | null = null;
	lastAutoRecoveryAt: number | null = null;
	lastStartupSnapshotPath: string | null = null;

	constructor(
		private app: App,
		private getBackupService: () => BackupService | null,
		private getBackgroundBackupManager: () => BackgroundBackupManager | null,
		private getCardStore: () => SqliteStoreService | undefined,
	) {}

	async tryAutoRecoverFromBackup(deviceId: string): Promise<boolean> {
		const backupFolder = normalizePath(`${DB_FOLDER}/backups/${deviceId}`);
		const dbPath = normalizePath(
			`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`,
		);

		try {
			const folderExists = await this.app.vault.adapter.exists(backupFolder);
			if (!folderExists) return false;

			const listing = await this.app.vault.adapter.list(backupFolder);
			const backupFiles = sortBackupPathsNewest(
				listing.files.filter((f) => isSupportedBackupPath(f)),
			);

			for (const backupPath of backupFiles) {
				try {
					const stat = await this.app.vault.adapter.stat(backupPath);
					if (!stat || stat.size < 16) continue;

					const rawData = await this.app.vault.adapter.readBinary(backupPath);
					const sqliteBytes = decodeBackupToSqliteBytes(backupPath, rawData);
					if (!sqliteBytes) continue;

					const corruptedPath = `${dbPath}.corrupted`;
					const corruptedExists =
						await this.app.vault.adapter.exists(corruptedPath);
					if (corruptedExists) {
						await this.app.vault.adapter.remove(corruptedPath);
					}
					const brokenExists = await this.app.vault.adapter.exists(dbPath);
					if (brokenExists) {
						await this.app.vault.adapter.rename(dbPath, corruptedPath);
					}
					await this.app.vault.adapter.writeBinary(
						dbPath,
						toExactBackupBuffer(sqliteBytes),
					);

					const backupName = backupPath.split("/").pop() || "";
					this.lastAutoRecoveryBackupPath = backupPath;
					this.lastAutoRecoveryAt = Date.now();
					console.log(
						`[True Recall] Auto-recovered from backup: ${backupName}`,
					);
					notify().success(
						`Database restored from backup after corruption detection: ${backupName}`,
						NOTIFICATION_DURATION.PERSIST,
					);
					return true;
				} catch {
					console.warn(
						`[True Recall] Backup file unreadable, skipping: ${backupPath}`,
					);
				}
			}
		} catch (error) {
			console.error("[True Recall] Auto-recovery failed:", error);
		}

		return false;
	}

	async runAutoBackup(): Promise<void> {
		const manager = this.getBackgroundBackupManager();
		if (!manager) return;

		try {
			const created = await manager.triggerBackup(true);
			const status = manager.getStatus();
			this.lastStartupSnapshotPath = status.sessionStartBackupPath;
			if (created) {
				notify().info(
					"Startup snapshot created. This does not restore or overwrite your current database.",
				);
			}
		} catch (error) {
			console.error("[True Recall] Auto-backup failed:", error);
		}
	}

	async createManualBackup(): Promise<void> {
		const manager = this.getBackgroundBackupManager();
		if (!manager) {
			notify().error("Backup service not available");
			return;
		}

		try {
			const created = await manager.triggerBackup(true);
			if (created) {
				notify().success("Backup created");
			} else {
				notify().info("No changes to backup");
			}
		} catch (error) {
			console.error("[True Recall] Manual backup failed:", error);
			notify().error("Failed to create backup. Check console for details.");
		}
	}

	async openRestoreBackupModal(): Promise<void> {
		const backupService = this.getBackupService();
		if (!backupService) {
			notify().error("Backup service not available");
			return;
		}

		const backups = await backupService.listBackups();
		if (backups.length === 0) {
			notify().info("No backups available");
			return;
		}

		const modal = new RestoreBackupModal(this.app, {
			backups,
			backupService,
			sessionStartBackupPath:
				this.getBackgroundBackupManager()?.getStatus().sessionStartBackupPath ??
				null,
		});

		await modal.openAndWait();
	}

	getStorageDiagnostics(): {
		activeDatabasePath: string | null;
		saveTimerActive: boolean;
		flushInProgress: boolean;
		isDirty: boolean;
		lastFlushStartedAt: number | null;
		lastFlushSucceededAt: number | null;
		lastFlushFailedAt: number | null;
		lastFlushError: string | null;
		startupSnapshotPath: string | null;
		lastAutoRecoveryPath: string | null;
		lastAutoRecoveryAt: number | null;
	} {
		const storeDebug = this.getCardStore()?.getPersistenceDebugInfo();
		return {
			activeDatabasePath: storeDebug?.dbPath ?? null,
			saveTimerActive: storeDebug?.saveTimerActive ?? false,
			flushInProgress: storeDebug?.flushInProgress ?? false,
			isDirty: storeDebug?.isDirty ?? false,
			lastFlushStartedAt: storeDebug?.lastFlushStartedAt ?? null,
			lastFlushSucceededAt: storeDebug?.lastFlushSucceededAt ?? null,
			lastFlushFailedAt: storeDebug?.lastFlushFailedAt ?? null,
			lastFlushError: storeDebug?.lastFlushError ?? null,
			startupSnapshotPath:
				this.lastStartupSnapshotPath ??
				this.getBackgroundBackupManager()?.getStatus().sessionStartBackupPath ??
				null,
			lastAutoRecoveryPath: this.lastAutoRecoveryBackupPath,
			lastAutoRecoveryAt: this.lastAutoRecoveryAt,
		};
	}
}
