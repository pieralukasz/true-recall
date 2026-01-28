/**
 * Restore Backup Modal
 * Allows user to select and restore a database backup
 */
import { App, Setting } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { BackupInfo, BackupService } from "../../services/persistence/backup.service";

export interface RestoreBackupResult extends CancellableResult {
    restoredPath?: string;
}

export interface RestoreBackupModalOptions {
    backups: BackupInfo[];
    backupService: BackupService;
}

/**
 * Modal for selecting and restoring a database backup
 */
export class RestoreBackupModal extends BasePromiseModal<RestoreBackupResult> {
    private backups: BackupInfo[];
    private backupService: BackupService;
    private selectedBackup: BackupInfo | null = null;

    constructor(app: App, options: RestoreBackupModalOptions) {
        super(app, {
            title: "Restore from Backup",
            width: "500px",
        });
        this.backups = options.backups;
        this.backupService = options.backupService;
    }

    protected getDefaultResult(): RestoreBackupResult {
        return { cancelled: true };
    }

    protected renderBody(container: HTMLElement): void {
        // Warning message
        const warningEl = container.createDiv({ cls: "true-recall-backup-warning" });
        warningEl.createEl("p", {
            text: "Restoring a backup will replace your current database. A safety backup will be created automatically before restoration.",
        });
        warningEl.style.backgroundColor = "var(--background-modifier-error)";
        warningEl.style.padding = "12px";
        warningEl.style.borderRadius = "6px";
        warningEl.style.marginBottom = "16px";
        warningEl.style.color = "var(--text-on-accent)";

        // Backup list
        const listContainer = container.createDiv({ cls: "true-recall-backup-list" });
        listContainer.style.maxHeight = "300px";
        listContainer.style.overflowY = "auto";
        listContainer.style.marginBottom = "16px";

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

        // Actions
        const actionsEl = container.createDiv({ cls: "true-recall-modal-actions" });
        actionsEl.style.display = "flex";
        actionsEl.style.justifyContent = "flex-end";
        actionsEl.style.gap = "8px";

        const cancelBtn = actionsEl.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        const restoreBtn = actionsEl.createEl("button", {
            text: "Restore Selected",
            cls: "mod-warning",
        });
        restoreBtn.disabled = true;
        restoreBtn.addEventListener("click", () => this.handleRestore());

        // Store reference for enabling/disabling
        this.restoreButton = restoreBtn;
    }

    private restoreButton: HTMLButtonElement | null = null;

    private renderBackupItem(container: HTMLElement, backup: BackupInfo): void {
        const itemEl = container.createDiv({ cls: "true-recall-backup-item" });
        itemEl.style.display = "flex";
        itemEl.style.justifyContent = "space-between";
        itemEl.style.alignItems = "center";
        itemEl.style.padding = "10px 12px";
        itemEl.style.borderRadius = "6px";
        itemEl.style.marginBottom = "4px";
        itemEl.style.cursor = "pointer";
        itemEl.style.backgroundColor = "var(--background-secondary)";
        itemEl.style.transition = "background-color 0.15s ease";

        // Left side: date and filename
        const infoEl = itemEl.createDiv();
        infoEl.createDiv({
            text: backup.formattedDate,
            cls: "true-recall-backup-date",
        }).style.fontWeight = "500";
        infoEl.createDiv({
            text: backup.filename,
            cls: "true-recall-backup-filename",
        }).style.fontSize = "0.85em";
        infoEl.querySelector(".true-recall-backup-filename")?.setAttribute("style",
            "font-size: 0.85em; color: var(--text-muted);");

        // Right side: size and delete button
        const rightEl = itemEl.createDiv();
        rightEl.style.display = "flex";
        rightEl.style.alignItems = "center";
        rightEl.style.gap = "12px";

        rightEl.createSpan({
            text: backup.formattedSize,
            cls: "true-recall-backup-size",
        }).style.color = "var(--text-muted)";

        const deleteBtn = rightEl.createEl("button", { text: "Delete" });
        deleteBtn.style.fontSize = "0.85em";
        deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.handleDeleteBackup(backup, itemEl);
        });

        // Selection handling
        itemEl.addEventListener("click", () => {
            // Remove selection from all items
            container.querySelectorAll(".true-recall-backup-item").forEach(el => {
                (el as HTMLElement).style.backgroundColor = "var(--background-secondary)";
                (el as HTMLElement).style.border = "none";
            });

            // Select this item
            itemEl.style.backgroundColor = "var(--interactive-accent)";
            itemEl.style.border = "2px solid var(--interactive-accent-hover)";
            this.selectedBackup = backup;

            // Enable restore button
            if (this.restoreButton) {
                this.restoreButton.disabled = false;
            }
        });

        // Hover effect
        itemEl.addEventListener("mouseenter", () => {
            if (this.selectedBackup !== backup) {
                itemEl.style.backgroundColor = "var(--background-modifier-hover)";
            }
        });
        itemEl.addEventListener("mouseleave", () => {
            if (this.selectedBackup !== backup) {
                itemEl.style.backgroundColor = "var(--background-secondary)";
            }
        });
    }

    private async handleDeleteBackup(backup: BackupInfo, itemEl: HTMLElement): Promise<void> {
        const confirmed = confirm(`Delete backup from ${backup.formattedDate}?`);
        if (!confirmed) return;

        const success = await this.backupService.deleteBackup(backup.path);
        if (success) {
            // Remove from list
            this.backups = this.backups.filter(b => b.path !== backup.path);
            itemEl.remove();

            // Clear selection if deleted backup was selected
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
