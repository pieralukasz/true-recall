/**
 * Device Selection Modal
 * Shown at first run when other device databases are available.
 * Allows user to start fresh or import from another device.
 */
import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { DeviceDatabaseInfo } from "../../services/device";

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
        const introEl = container.createDiv({ cls: "true-recall-device-intro" });
        introEl.createEl("p", {
            text: "Choose how to initialize the database on this device:",
        });
        introEl.setCssProps({ "margin-bottom": "16px" });

        const optionsEl = container.createDiv({ cls: "true-recall-device-options" });

        const freshOption = this.createRadioOption(
            optionsEl,
            "fresh",
            "Start fresh",
            "Create a new, empty database"
        );
        freshOption.radioEl.checked = true;

        if (this.databases.length > 0) {
            const importOption = this.createRadioOption(
                optionsEl,
                "import",
                "Import from another device",
                "Copy data from an existing database"
            );

            const dbListContainer = container.createDiv({
                cls: "true-recall-device-db-list",
            });
            dbListContainer.setCssProps({
                display: "none",
                "margin-left": "28px",
                "margin-top": "8px",
                "margin-bottom": "16px",
            });

            for (const db of this.databases) {
                this.renderDatabaseItem(dbListContainer, db);
            }

            freshOption.radioEl.addEventListener("change", () => {
                if (freshOption.radioEl.checked) {
                    this.selectedAction = "fresh";
                    dbListContainer.setCssProps({ display: "none" });
                    this.updateContinueButton();
                }
            });

            importOption.radioEl.addEventListener("change", () => {
                if (importOption.radioEl.checked) {
                    this.selectedAction = "import";
                    dbListContainer.setCssProps({ display: "block" });
                    this.updateContinueButton();
                }
            });
        }

        const actionsEl = container.createDiv({ cls: "true-recall-modal-actions" });
        actionsEl.setCssProps({
            display: "flex",
            "justify-content": "flex-end",
            gap: "8px",
            "margin-top": "24px",
        });

        const cancelBtn = actionsEl.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        this.continueButton = actionsEl.createEl("button", {
            text: "Continue",
            cls: "mod-cta",
        });
        this.continueButton.addEventListener("click", () => this.handleContinue());
    }

    private createRadioOption(
        container: HTMLElement,
        value: string,
        label: string,
        description: string
    ): { itemEl: HTMLElement; radioEl: HTMLInputElement } {
        const itemEl = container.createDiv({ cls: "true-recall-device-option" });
        itemEl.setCssProps({
            display: "flex",
            "align-items": "flex-start",
            gap: "12px",
            padding: "12px",
            "border-radius": "6px",
            "margin-bottom": "8px",
            cursor: "pointer",
            "background-color": "var(--background-secondary)",
        });

        const radioEl = itemEl.createEl("input", {
            type: "radio",
            attr: { name: "device-action", value },
        });
        radioEl.setCssProps({ "margin-top": "2px" });

        const textEl = itemEl.createDiv();
        const labelEl = textEl.createDiv({ text: label });
        labelEl.setCssProps({ "font-weight": "500" });
        const descEl = textEl.createDiv({
            text: description,
            cls: "setting-item-description",
        });
        descEl.setCssProps({ "margin-top": "2px" });

        itemEl.addEventListener("click", (e) => {
            if (e.target !== radioEl) {
                radioEl.checked = true;
                radioEl.dispatchEvent(new Event("change"));
            }
        });

        radioEl.addEventListener("change", () => {
            container
                .querySelectorAll(".true-recall-device-option")
                .forEach((el) => {
                    (el as HTMLElement).setCssProps({
                        "background-color": "var(--background-secondary)",
                        border: "none",
                    });
                });
            if (radioEl.checked) {
                itemEl.setCssProps({
                    "background-color": "var(--background-modifier-hover)",
                    border: "1px solid var(--interactive-accent)",
                });
            }
        });

        return { itemEl, radioEl };
    }

    private renderDatabaseItem(
        container: HTMLElement,
        db: DeviceDatabaseInfo
    ): void {
        const itemEl = container.createDiv({ cls: "true-recall-device-db-item" });
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
        const headerEl = infoEl.createDiv();
        headerEl.setCssProps({
            display: "flex",
            "align-items": "center",
            gap: "8px",
        });

        headerEl.createSpan({ text: "device" });
        const deviceIdEl = headerEl.createSpan({
            text: db.deviceId,
            cls: "true-recall-device-id",
        });
        deviceIdEl.setCssProps({ "font-family": "monospace" });

        const statsEl = infoEl.createDiv();
        statsEl.setCssProps({
            "font-size": "0.85em",
            color: "var(--text-muted)",
            "margin-top": "4px",
        });

        const statsParts: string[] = [];
        if (db.cardCount !== null) {
            statsParts.push(`${db.cardCount.toLocaleString()} cards`);
        }
        if (db.lastReviewDate) {
            statsParts.push(`Last: ${this.formatDate(db.lastReviewDate)}`);
        }
        statsEl.textContent = statsParts.join(" | ");

        const rightEl = itemEl.createDiv();
        rightEl.setCssProps({
            "text-align": "right",
            "font-size": "0.85em",
            color: "var(--text-muted)",
        });

        rightEl.createDiv({ text: db.formattedSize });
        rightEl.createDiv({ text: `Mod: ${this.formatRelativeTime(db.lastModified)}` });

        itemEl.addEventListener("click", () => {
            container.querySelectorAll(".true-recall-device-db-item").forEach((el) => {
                (el as HTMLElement).setCssProps({
                    "background-color": "var(--background-secondary)",
                    border: "none",
                });
            });

            itemEl.setCssProps({
                "background-color": "var(--interactive-accent)",
                border: "2px solid var(--interactive-accent-hover)",
            });
            this.selectedDatabase = db;
            this.updateContinueButton();
        });

        itemEl.addEventListener("mouseenter", () => {
            if (this.selectedDatabase !== db) {
                itemEl.setCssProps({ "background-color": "var(--background-modifier-hover)" });
            }
        });
        itemEl.addEventListener("mouseleave", () => {
            if (this.selectedDatabase !== db) {
                itemEl.setCssProps({ "background-color": "var(--background-secondary)" });
            }
        });
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
