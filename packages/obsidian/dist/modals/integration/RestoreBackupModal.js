import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal, } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
function BackupItem({ backup, isSelected, isSessionStart, onSelect, onDelete, }) {
    return (_jsxs(Clickable, { stopPropagation: false, class: `ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ${isSelected ? "ep:bg-obs-interactive/10 ep:border-l-2 ep:border-l-obs-interactive" : ""}`, onClick: onSelect, children: [_jsxs("div", { class: "ep:flex-1 ep:overflow-hidden", children: [_jsxs("div", { class: "ep:font-medium ep:flex ep:items-center ep:gap-2", children: [backup.formattedDate, isSessionStart && (_jsx("span", { class: "ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-medium", children: "startup snapshot" }))] }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: backup.filename })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-3", children: [_jsx("span", { class: "ep:text-obs-muted", children: backup.formattedSize }), _jsx(Clickable, { class: "ep:text-ui-smaller", onClick: onDelete, children: "Delete" })] })] }));
}
function RestoreBackupBody({ initialBackups, sessionStartBackupPath, onResolve, onClose, onDeleteBackup, onRestore, }) {
    const [backups, setBackups] = useState(initialBackups);
    const [selectedBackup, setSelectedBackup] = useState(null);
    const handleDelete = useCallback((backup) => __awaiter(this, void 0, void 0, function* () {
        const success = yield onDeleteBackup(backup);
        if (success) {
            setBackups((prev) => prev.filter((b) => b.path !== backup.path));
            setSelectedBackup((prev) => (prev === backup ? null : prev));
        }
    }), [onDeleteBackup]);
    const handleRestore = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!selectedBackup)
            return;
        const success = yield onRestore(selectedBackup);
        if (success) {
            onResolve({ cancelled: false, restoredPath: selectedBackup.path });
        }
    }), [selectedBackup, onRestore, onResolve]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:bg-obs-modifier-error ep:p-3 ep:rounded-md ep:mb-4 ep:text-obs-on-accent", children: _jsx("p", { children: "Restoring a backup will replace your current database. A safety backup will be created automatically before restoration." }) }), _jsx("div", { class: "ep:max-h-[300px] ep:overflow-y-auto ep:mb-4", children: backups.length === 0 ? (_jsx("p", { class: "ep:text-obs-muted ep:p-3", children: "No backups available." })) : (backups.map((backup) => (_jsx(BackupItem, { backup: backup, isSelected: selectedBackup === backup, isSessionStart: backup.path === sessionStartBackupPath, onSelect: () => setSelectedBackup(backup), onDelete: () => void handleDelete(backup) }, backup.path)))) }), _jsxs("div", { class: "ep-modal-footer ep:flex ep:justify-end ep:gap-2", children: [_jsx(Clickable, { stopPropagation: false, class: "ep-btn ep-btn-outline", onClick: onClose, children: "Cancel" }), _jsx(Clickable, { stopPropagation: false, class: "mod-warning ep-btn", disabled: !selectedBackup, onClick: () => void handleRestore(), children: "Restore selected" })] })] }));
}
export class RestoreBackupModal extends BasePromiseModal {
    constructor(app, options) {
        super(app, {
            title: "Restore from backup",
            width: "500px",
        });
        this.backups = options.backups;
        this.backupService = options.backupService;
        this.sessionStartBackupPath = options.sessionStartBackupPath;
    }
    getDefaultResult() {
        return { cancelled: true };
    }
    renderBody(container) {
        render(_jsx(RestoreBackupBody, { initialBackups: this.backups, sessionStartBackupPath: this.sessionStartBackupPath, onResolve: (result) => this.resolve(result), onClose: () => this.close(), onDeleteBackup: (backup) => this.handleDeleteBackup(backup), onRestore: (backup) => this.handleRestore(backup) }), container);
    }
    handleDeleteBackup(backup) {
        return __awaiter(this, void 0, void 0, function* () {
            const confirmed = yield confirm(this.app, {
                message: `Delete backup from ${backup.formattedDate}?`,
            });
            if (!confirmed)
                return false;
            return this.backupService.deleteBackup(backup.path);
        });
    }
    handleRestore(backup) {
        return __awaiter(this, void 0, void 0, function* () {
            const confirmed = yield confirm(this.app, {
                message: `Are you sure you want to restore the backup from ${backup.formattedDate}?\n\n` +
                    "Your current database will be replaced. A safety backup will be created first.\n\n" +
                    "You will need to reload Obsidian after restoration.",
            });
            if (!confirmed)
                return false;
            return this.backupService.restoreFromBackup(backup.path);
        });
    }
}
