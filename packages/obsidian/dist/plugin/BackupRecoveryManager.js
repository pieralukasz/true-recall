import { __awaiter } from "tslib";
import { decodeBackupToSqliteBytes, isSupportedBackupPath, sortBackupPathsNewest, toExactBackupBuffer, } from "@true-recall/core/persistence/sqlite/recovery.utils";
import { DB_FOLDER, getDeviceDbFilename, } from "@true-recall/core/persistence/sqlite/sqlite.types";
import { RestoreBackupModal } from "@true-recall/obsidian/modals/integration/RestoreBackupModal";
import { NOTIFICATION_DURATION, notify, } from "@true-recall/obsidian/services/notification.service";
import { normalizePath } from "obsidian";
export class BackupRecoveryManager {
    constructor(app, getBackupService, getBackgroundBackupManager, getCardStore) {
        this.app = app;
        this.getBackupService = getBackupService;
        this.getBackgroundBackupManager = getBackgroundBackupManager;
        this.getCardStore = getCardStore;
        this.lastAutoRecoveryBackupPath = null;
        this.lastAutoRecoveryAt = null;
        this.lastStartupSnapshotPath = null;
    }
    tryAutoRecoverFromBackup(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const backupFolder = normalizePath(`${DB_FOLDER}/backups/${deviceId}`);
            const dbPath = normalizePath(`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`);
            try {
                const folderExists = yield this.app.vault.adapter.exists(backupFolder);
                if (!folderExists)
                    return false;
                const listing = yield this.app.vault.adapter.list(backupFolder);
                const backupFiles = sortBackupPathsNewest(listing.files.filter((f) => isSupportedBackupPath(f)));
                for (const backupPath of backupFiles) {
                    try {
                        const stat = yield this.app.vault.adapter.stat(backupPath);
                        if (!stat || stat.size < 16)
                            continue;
                        const rawData = yield this.app.vault.adapter.readBinary(backupPath);
                        const sqliteBytes = decodeBackupToSqliteBytes(backupPath, rawData);
                        if (!sqliteBytes)
                            continue;
                        const corruptedPath = `${dbPath}.corrupted`;
                        const corruptedExists = yield this.app.vault.adapter.exists(corruptedPath);
                        if (corruptedExists) {
                            yield this.app.vault.adapter.remove(corruptedPath);
                        }
                        const brokenExists = yield this.app.vault.adapter.exists(dbPath);
                        if (brokenExists) {
                            yield this.app.vault.adapter.rename(dbPath, corruptedPath);
                        }
                        yield this.app.vault.adapter.writeBinary(dbPath, toExactBackupBuffer(sqliteBytes));
                        const backupName = backupPath.split("/").pop() || "";
                        this.lastAutoRecoveryBackupPath = backupPath;
                        this.lastAutoRecoveryAt = Date.now();
                        console.debug(`[True Recall] Auto-recovered from backup: ${backupName}`);
                        notify().success(`Database restored from backup after corruption detection: ${backupName}`, NOTIFICATION_DURATION.PERSIST);
                        return true;
                    }
                    catch (_a) {
                        console.warn(`[True Recall] Backup file unreadable, skipping: ${backupPath}`);
                    }
                }
            }
            catch (error) {
                console.error("[True Recall] Auto-recovery failed:", error);
            }
            return false;
        });
    }
    runAutoBackup() {
        return __awaiter(this, void 0, void 0, function* () {
            const manager = this.getBackgroundBackupManager();
            if (!manager)
                return;
            try {
                const created = yield manager.triggerBackup(true);
                const status = manager.getStatus();
                this.lastStartupSnapshotPath = status.sessionStartBackupPath;
                if (created) {
                    notify().info("Startup snapshot created. This does not restore or overwrite your current database.");
                }
            }
            catch (error) {
                console.error("[True Recall] Auto-backup failed:", error);
            }
        });
    }
    createManualBackup() {
        return __awaiter(this, void 0, void 0, function* () {
            const manager = this.getBackgroundBackupManager();
            if (!manager) {
                notify().error("Backup service not available");
                return;
            }
            try {
                const created = yield manager.triggerBackup(true);
                if (created) {
                    notify().success("Backup created");
                }
                else {
                    notify().info("No changes to backup");
                }
            }
            catch (error) {
                console.error("[True Recall] Manual backup failed:", error);
                notify().error("Failed to create backup. Check console for details.");
            }
        });
    }
    openRestoreBackupModal() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const backupService = this.getBackupService();
            if (!backupService) {
                notify().error("Backup service not available");
                return;
            }
            const backups = yield backupService.listBackups();
            if (backups.length === 0) {
                notify().info("No backups available");
                return;
            }
            const modal = new RestoreBackupModal(this.app, {
                backups,
                backupService,
                sessionStartBackupPath: (_b = (_a = this.getBackgroundBackupManager()) === null || _a === void 0 ? void 0 : _a.getStatus().sessionStartBackupPath) !== null && _b !== void 0 ? _b : null,
            });
            yield modal.openAndWait();
        });
    }
    getStorageDiagnostics() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const storeDebug = (_a = this.getCardStore()) === null || _a === void 0 ? void 0 : _a.getPersistenceDebugInfo();
        return {
            activeDatabasePath: (_b = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.dbPath) !== null && _b !== void 0 ? _b : null,
            saveTimerActive: (_c = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.saveTimerActive) !== null && _c !== void 0 ? _c : false,
            flushInProgress: (_d = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.flushInProgress) !== null && _d !== void 0 ? _d : false,
            isDirty: (_e = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.isDirty) !== null && _e !== void 0 ? _e : false,
            lastFlushStartedAt: (_f = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.lastFlushStartedAt) !== null && _f !== void 0 ? _f : null,
            lastFlushSucceededAt: (_g = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.lastFlushSucceededAt) !== null && _g !== void 0 ? _g : null,
            lastFlushFailedAt: (_h = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.lastFlushFailedAt) !== null && _h !== void 0 ? _h : null,
            lastFlushError: (_j = storeDebug === null || storeDebug === void 0 ? void 0 : storeDebug.lastFlushError) !== null && _j !== void 0 ? _j : null,
            startupSnapshotPath: (_m = (_k = this.lastStartupSnapshotPath) !== null && _k !== void 0 ? _k : (_l = this.getBackgroundBackupManager()) === null || _l === void 0 ? void 0 : _l.getStatus().sessionStartBackupPath) !== null && _m !== void 0 ? _m : null,
            lastAutoRecoveryPath: this.lastAutoRecoveryBackupPath,
            lastAutoRecoveryAt: this.lastAutoRecoveryAt,
        };
    }
}
