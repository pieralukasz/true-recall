import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { DeviceDatabaseInfo } from "../../services/device";
import { createSelectableListItem, type SelectableListItem } from "../components";

export interface DeviceSelectionResult extends CancellableResult {
    action: "fresh" | "import";
    sourceDeviceId?: string;
    sourcePath?: string;
}

export interface DeviceSelectionModalOptions {
    databases: DeviceDatabaseInfo[];
    hasLegacy: boolean;
}

export class DeviceSelectionModal extends BasePromiseModal<DeviceSelectionResult> {
    private databases: DeviceDatabaseInfo[];
    private hasLegacy: boolean;
    private selectedDatabase: DeviceDatabaseInfo | null = null;
    private selectedAction: "fresh" | "import" = "fresh";
    private continueButton: HTMLButtonElement | null = null;
    private dbItems: SelectableListItem[] = [];

    constructor(app: App, options: DeviceSelectionModalOptions) {
        super(app, {
            title: "True Recall database setup",
            width: "480px",
        });
        this.databases = options.databases;
        this.hasLegacy = options.hasLegacy;
    }

    protected getDefaultResult(): DeviceSelectionResult {
        return { cancelled: true, action: "fresh" };
    }

    protected renderBody(container: HTMLElement): void {
        const introEl = container.createDiv({ cls: "ep:mb-4" });
        introEl.createEl("p", {
            text: "Choose how to initialize the database on this device:",
        });

        const optionsEl = container.createDiv();

        const freshRadio = this.createRadioOption(
            optionsEl,
            "fresh",
            "Start fresh",
            "Create a new, empty database"
        );
        freshRadio.checked = true;

        if (this.databases.length > 0) {
            const importRadio = this.createRadioOption(
                optionsEl,
                "import",
                "Import from another device",
                "Copy data from an existing database"
            );

            const dbListContainer = container.createDiv({
                cls: "ep:hidden ep:ml-7 ep:mt-2 ep:mb-4",
            });

            for (const db of this.databases) {
                this.renderDatabaseItem(dbListContainer, db);
            }

            this.addDomEvent(freshRadio, "change", () => {
                if (freshRadio.checked) {
                    this.selectedAction = "fresh";
                    dbListContainer.addClass("ep:hidden");
                    this.updateContinueButton();
                }
            });

            this.addDomEvent(importRadio, "change", () => {
                if (importRadio.checked) {
                    this.selectedAction = "import";
                    dbListContainer.removeClass("ep:hidden");
                    this.updateContinueButton();
                }
            });
        }

        const buttonsEl = this.createButtonsSection(container, [
            { text: "Cancel", type: "secondary", onClick: () => this.close() },
            { text: "Continue", type: "primary", onClick: () => this.handleContinue() },
        ]);
        this.continueButton = buttonsEl.querySelector("button:last-child") as HTMLButtonElement;
    }

    private createRadioOption(
        container: HTMLElement,
        value: string,
        label: string,
        description: string
    ): HTMLInputElement {
        const itemEl = container.createDiv({
            cls: "ep:flex ep:items-start ep:gap-3 ep:p-3 ep:rounded-md ep:mb-2 ep:cursor-pointer ep:bg-obs-secondary ep:transition-colors ep:hover:bg-obs-modifier-hover",
        });

        const radioEl = itemEl.createEl("input", {
            type: "radio",
            attr: { name: "device-action", value },
            cls: "ep:mt-0.5 ep:shrink-0",
        });

        const textEl = itemEl.createDiv();
        textEl.createDiv({
            text: label,
            cls: "ep:font-medium",
        });
        textEl.createDiv({
            text: description,
            cls: "setting-item-description ep:mt-0.5",
        });

        this.addDomEvent(itemEl, "click", (e: MouseEvent) => {
            if (e.target !== radioEl) {
                radioEl.checked = true;
                radioEl.dispatchEvent(new Event("change"));
            }
        });

        // Selection highlight on change
        this.addDomEvent(radioEl, "change", () => {
            container
                .querySelectorAll(":scope > div")
                .forEach((el) => {
                    (el as HTMLElement).removeClass("ep-radio-active");
                });
            if (radioEl.checked) {
                itemEl.addClass("ep-radio-active");
            }
        });

        return radioEl;
    }

    private renderDatabaseItem(
        container: HTMLElement,
        db: DeviceDatabaseInfo
    ): void {
        const item = createSelectableListItem(container, {
            renderContent: (el) => {
                const headerEl = el.createDiv({
                    cls: "ep:flex ep:items-center ep:gap-2",
                });
                headerEl.createSpan({ text: "device" });
                headerEl.createSpan({
                    text: db.deviceId,
                    cls: "ep:font-mono",
                });

                const statsEl = el.createDiv({
                    cls: "ep:text-ui-smaller ep:text-obs-muted ep:mt-1",
                });
                const statsParts: string[] = [];
                if (db.cardCount !== null) {
                    statsParts.push(`${db.cardCount.toLocaleString()} cards`);
                }
                if (db.lastReviewDate) {
                    statsParts.push(`Last: ${this.formatDate(db.lastReviewDate)}`);
                }
                statsEl.textContent = statsParts.join(" | ");
            },
            renderRight: (el) => {
                el.addClass("ep:text-right", "ep:text-ui-smaller", "ep:text-obs-muted");
                el.createDiv({ text: db.formattedSize });
                el.createDiv({ text: `Mod: ${this.formatRelativeTime(db.lastModified)}` });
            },
            onSelect: () => {
                this.deselectAllDbItems();
                item.setSelected(true);
                this.selectedDatabase = db;
                this.updateContinueButton();
            },
        });
        this.dbItems.push(item);
    }

    private deselectAllDbItems(): void {
        for (const item of this.dbItems) {
            item.setSelected(false);
        }
    }

    private updateContinueButton(): void {
        if (!this.continueButton) return;

        const canContinue =
            this.selectedAction === "fresh" ||
            (this.selectedAction === "import" && this.selectedDatabase !== null);

        this.continueButton.disabled = !canContinue;
    }

    private handleContinue(): void {
        if (this.selectedAction === "fresh") {
            this.resolve({
                cancelled: false,
                action: "fresh",
            });
        } else if (this.selectedAction === "import" && this.selectedDatabase) {
            this.resolve({
                cancelled: false,
                action: "import",
                sourceDeviceId: this.selectedDatabase.deviceId,
                sourcePath: this.selectedDatabase.path,
            });
        }
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
        });
    }

    private formatRelativeTime(date: Date): string {
        const now = Date.now();
        const diffMs = now - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) {
            return "just now";
        } else if (diffMinutes < 60) {
            return `${diffMinutes}min ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return this.formatDate(date);
        }
    }
}
