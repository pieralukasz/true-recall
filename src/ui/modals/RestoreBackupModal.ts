/**
 * Restore Backup Modal
 * Allows user to select and restore a database backup
 */
import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { BackupInfo, BackupService } from "../../services/persistence/backup.service";

export interface RestoreBackupResult extends CancellableResult {
    restoredPath?: string;
}

export interface RestoreBackupModalOptions {
    backups: BackupInfo[];
    backupService: BackupService;
}

export class RestoreBackupModal extends BasePromiseModal<RestoreBackupResult> {
    private backups: BackupInfo[];
    private backupService: BackupService;
    private selectedBackup: BackupInfo | null = null;

    constructor(app: App, options: RestoreBackupModalOptions) {
        super(app, {
            title: "Restore from backup",
            width: "500px",
        });
        this.backups = options.backups;
        this.backupService = options.backupService;
    }

    protected getDefaultResult(): RestoreBackupResult {
        return { cancelled: true };
    }

    protected renderBody(container: HTMLElement): void {
        const warningEl = container.createDiv({ cls: "true-recall-backup-warning" });
        warningEl.createEl("p", {
            text: "Restoring a backup will replace your current database. A safety backup will be created automatically before restoration.",
        });
        warningEl.setCssProps({
            "background-color": "var(--background-modifier-error)",
            padding: "12px",
            "border-radius": "6px",
            "margin-bottom": "16px",
            color: "var(--text-on-accent)",
        });

        const listContainer = container.createDiv({ cls: "true-recall-backup-list" });
        listContainer.setCssProps({
            "max-height": "300px",
            "overflow-y": "auto",
            "margin-bottom": "16px",
        });

        if (this.backups.length === 0) {
            listContainer.createEl("p", {
                text: "No backups available.",
                cls: "true-recall-no-backups",
            });
        } else {
            for (const backup of this.backups) {
                this.renderBackupItem(listContainer, backup);
            }
        }

        const actionsEl = container.createDiv({ cls: "true-recall-modal-actions" });
        actionsEl.setCssProps({
            display: "flex",
            "justify-content": "flex-end",
            gap: "8px",
        });

        const cancelBtn = actionsEl.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        const restoreBtn = actionsEl.createEl("button", {
            text: "Restore selected",
            cls: "mod-warning",
        });
        restoreBtn.disabled = true;
        restoreBtn.addEventListener("click", () => {
            void this.handleRestore();
        });

        this.restoreButton = restoreBtn;
    }

    private restoreButton: HTMLButtonElement | null = null;

    private renderBackupItem(container: HTMLElement, backup: BackupInfo): void {
        const itemEl = container.createDiv({ cls: "true-recall-backup-item" });
        itemEl.setCssProps({
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            padding: "10px 12px",
            "border-radius": "6px",
            "margin-bottom": "4px",
            cursor: "pointer",
            "background-color": "var(--background-secondary)",
            transition: "background-color 0.15s ease",
        });

        const infoEl = itemEl.createDiv();
        const dateEl = infoEl.createDiv({
            text: backup.formattedDate,
            cls: "true-recall-backup-date",
        });
        dateEl.setCssProps({ "font-weight": "500" });

        const filenameEl = infoEl.createDiv({
            text: backup.filename,
            cls: "true-recall-backup-filename",
        });
        filenameEl.setCssProps({
            "font-size": "0.85em",
            color: "var(--text-muted)",
        });

        const rightEl = itemEl.createDiv();
        rightEl.setCssProps({
            display: "flex",
            "align-items": "center",
            gap: "12px",
        });

        const sizeEl = rightEl.createSpan({
            text: backup.formattedSize,
            cls: "true-recall-backup-size",
        });
        sizeEl.setCssProps({ color: "var(--text-muted)" });

        const deleteBtn = rightEl.createEl("button", { text: "Delete" });
        deleteBtn.setCssProps({ "font-size": "0.85em" });
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            void this.handleDeleteBackup(backup, itemEl);
        });

        itemEl.addEventListener("click", () => {
            container.querySelectorAll(".true-recall-backup-item").forEach(el => {
                (el as HTMLElement).setCssProps({
                    "background-color": "var(--background-secondary)",
                    border: "none",
                });
            });

            itemEl.setCssProps({
                "background-color": "var(--interactive-accent)",
                border: "2px solid var(--interactive-accent-hover)",
            });
            this.selectedBackup = backup;

            if (this.restoreButton) {
                this.restoreButton.disabled = false;
            }
        });

        itemEl.addEventListener("mouseenter", () => {
            if (this.selectedBackup !== backup) {
                itemEl.setCssProps({ "background-color": "var(--background-modifier-hover)" });
            }
        });
        itemEl.addEventListener("mouseleave", () => {
            if (this.selectedBackup !== backup) {
                itemEl.setCssProps({ "background-color": "var(--background-secondary)" });
            }
        });
    }

    private async handleDeleteBackup(backup: BackupInfo, itemEl: HTMLElement): Promise<void> {
        // eslint-disable-next-line no-alert
        const confirmed = confirm(`Delete backup from ${backup.formattedDate}?`);
        if (!confirmed) return;

        const success = await this.backupService.deleteBackup(backup.path);
        if (success) {
            this.backups = this.backups.filter(b => b.path !== backup.path);
            itemEl.remove();

            if (this.selectedBackup === backup) {
                this.selectedBackup = null;
                if (this.restoreButton) {
                    this.restoreButton.disabled = true;
                }
            }
        }
    }

    private async handleRestore(): Promise<void> {
        if (!this.selectedBackup) return;

        // eslint-disable-next-line no-alert
        const confirmed = confirm(
            `Are you sure you want to restore the backup from ${this.selectedBackup.formattedDate}?\n\n` +
            "Your current database will be replaced. A safety backup will be created first.\n\n" +
            "You will need to reload Obsidian after restoration."
        );

        if (!confirmed) return;

        const success = await this.backupService.restoreFromBackup(this.selectedBackup.path);
        if (success) {
            this.resolve({
                cancelled: false,
                restoredPath: this.selectedBackup.path,
            });
        }
    }
}
