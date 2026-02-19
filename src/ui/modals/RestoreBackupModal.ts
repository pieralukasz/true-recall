import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { BackupInfo, BackupService } from "../../services/persistence/backup.service";
import { createSelectableListItem, type SelectableListItem } from "../components";

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
    private restoreButton: HTMLButtonElement | null = null;
    private items: SelectableListItem[] = [];

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
        const warningEl = container.createDiv({
            cls: "ep:bg-obs-modifier-error ep:p-3 ep:rounded-md ep:mb-4 ep:text-obs-on-accent",
        });
        warningEl.createEl("p", {
            text: "Restoring a backup will replace your current database. A safety backup will be created automatically before restoration.",
        });

        const listContainer = container.createDiv({
            cls: "ep:max-h-[300px] ep:overflow-y-auto ep:mb-4",
        });

        if (this.backups.length === 0) {
            listContainer.createEl("p", {
                text: "No backups available.",
                cls: "ep:text-obs-muted ep:p-3",
            });
        } else {
            for (const backup of this.backups) {
                this.renderBackupItem(listContainer, backup);
            }
        }

        const buttonsEl = this.createButtonsSection(container, [
            { text: "Cancel", type: "secondary", onClick: () => this.close() },
            {
                text: "Restore selected",
                type: "danger",
                onClick: () => void this.handleRestore(),
                disabled: true,
            },
        ]);
        this.restoreButton = buttonsEl.querySelector("button:last-child") as HTMLButtonElement;
    }

    private renderBackupItem(container: HTMLElement, backup: BackupInfo): void {
        const item = createSelectableListItem(container, {
            renderContent: (el) => {
                el.createDiv({
                    text: backup.formattedDate,
                    cls: "ep:font-medium",
                });
                el.createDiv({
                    text: backup.filename,
                    cls: "ep:text-ui-smaller ep:text-obs-muted",
                });
            },
            renderRight: (el) => {
                const rightEl = el.createDiv({
                    cls: "ep:flex ep:items-center ep:gap-3",
                });
                rightEl.createSpan({
                    text: backup.formattedSize,
                    cls: "ep:text-obs-muted",
                });
                const deleteBtn = rightEl.createEl("button", {
                    text: "Delete",
                    cls: "ep:text-ui-smaller",
                });
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    void this.handleDeleteBackup(backup, item);
                });
            },
            onSelect: () => {
                this.deselectAll();
                item.setSelected(true);
                this.selectedBackup = backup;
                this.enableRestoreButton();
            },
        });
        this.items.push(item);
    }

    private deselectAll(): void {
        for (const item of this.items) {
            item.setSelected(false);
        }
    }

    private enableRestoreButton(): void {
        if (this.restoreButton) {
            this.restoreButton.disabled = false;
            this.restoreButton.removeClass("ep:opacity-50", "ep:cursor-not-allowed");
        }
    }

    private async handleDeleteBackup(backup: BackupInfo, item: SelectableListItem): Promise<void> {
        // eslint-disable-next-line no-alert
        const confirmed = confirm(`Delete backup from ${backup.formattedDate}?`);
        if (!confirmed) return;

        const success = await this.backupService.deleteBackup(backup.path);
        if (success) {
            this.backups = this.backups.filter(b => b.path !== backup.path);
            this.items = this.items.filter(i => i !== item);
            item.destroy();

            if (this.selectedBackup === backup) {
                this.selectedBackup = null;
                if (this.restoreButton) {
                    this.restoreButton.disabled = true;
                    this.restoreButton.addClass("ep:opacity-50", "ep:cursor-not-allowed");
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
