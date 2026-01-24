/**
 * Device Selection Modal
 * Shown at first run when other device databases are available.
 * Allows user to start fresh or import from another device.
 */
import { App } from "obsidian";
import { BasePromiseModal, type CancellableResult } from "./BasePromiseModal";
import type { DeviceDatabaseInfo } from "../../services/device";

/**
 * Result from the device selection modal.
 */
export interface DeviceSelectionResult extends CancellableResult {
    /** Action to take: start fresh or import from another device */
    action: "fresh" | "import";
    /** Device ID of the source database (if importing) */
    sourceDeviceId?: string;
    /** Full path to the source database (if importing) */
    sourcePath?: string;
}

/**
 * Options for the device selection modal.
 */
export interface DeviceSelectionModalOptions {
    /** Available device databases to import from */
    databases: DeviceDatabaseInfo[];
    /** Whether a legacy database exists */
    hasLegacy: boolean;
}

/**
 * Modal for selecting database initialization strategy.
 * Shown when:
 * - First run on a new device
 * - Other device databases are available to import from
 */
export class DeviceSelectionModal extends BasePromiseModal<DeviceSelectionResult> {
    private databases: DeviceDatabaseInfo[];
    private hasLegacy: boolean;
    private selectedDatabase: DeviceDatabaseInfo | null = null;
    private selectedAction: "fresh" | "import" = "fresh";
    private continueButton: HTMLButtonElement | null = null;

    constructor(app: App, options: DeviceSelectionModalOptions) {
        super(app, {
            title: "Episteme Database Setup",
            width: "480px",
        });
        this.databases = options.databases;
        this.hasLegacy = options.hasLegacy;
    }

    protected getDefaultResult(): DeviceSelectionResult {
        return { cancelled: true, action: "fresh" };
    }

    protected renderBody(container: HTMLElement): void {
        // Introduction
        const introEl = container.createDiv({ cls: "episteme-device-intro" });
        introEl.createEl("p", {
            text: "Choose how to initialize the database on this device:",
        });
        introEl.style.marginBottom = "16px";

        // Radio group container
        const optionsEl = container.createDiv({ cls: "episteme-device-options" });

        // Option 1: Start fresh
        const freshOption = this.createRadioOption(
            optionsEl,
            "fresh",
            "Start fresh",
            "Create a new, empty database"
        );
        freshOption.radioEl.checked = true;

        // Option 2: Import from other device (if databases available)
        if (this.databases.length > 0) {
            const importOption = this.createRadioOption(
                optionsEl,
                "import",
                "Import from another device",
                "Copy data from an existing database"
            );

            // Database list (shown when import is selected)
            const dbListContainer = container.createDiv({
                cls: "episteme-device-db-list",
            });
            dbListContainer.style.display = "none";
            dbListContainer.style.marginLeft = "28px";
            dbListContainer.style.marginTop = "8px";
            dbListContainer.style.marginBottom = "16px";

            for (const db of this.databases) {
                this.renderDatabaseItem(dbListContainer, db);
            }

            // Toggle database list visibility based on radio selection
            freshOption.radioEl.addEventListener("change", () => {
                if (freshOption.radioEl.checked) {
                    this.selectedAction = "fresh";
                    dbListContainer.style.display = "none";
                    this.updateContinueButton();
                }
            });

            importOption.radioEl.addEventListener("change", () => {
                if (importOption.radioEl.checked) {
                    this.selectedAction = "import";
                    dbListContainer.style.display = "block";
                    this.updateContinueButton();
                }
            });
        }

        // Actions
        const actionsEl = container.createDiv({ cls: "episteme-modal-actions" });
        actionsEl.style.display = "flex";
        actionsEl.style.justifyContent = "flex-end";
        actionsEl.style.gap = "8px";
        actionsEl.style.marginTop = "24px";

        const cancelBtn = actionsEl.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());

        this.continueButton = actionsEl.createEl("button", {
            text: "Continue",
            cls: "mod-cta",
        });
        this.continueButton.addEventListener("click", () => this.handleContinue());
    }

    /**
     * Create a radio option with label and description.
     */
    private createRadioOption(
        container: HTMLElement,
        value: string,
        label: string,
        description: string
    ): { itemEl: HTMLElement; radioEl: HTMLInputElement } {
        const itemEl = container.createDiv({ cls: "episteme-device-option" });
        itemEl.style.display = "flex";
        itemEl.style.alignItems = "flex-start";
        itemEl.style.gap = "12px";
        itemEl.style.padding = "12px";
        itemEl.style.borderRadius = "6px";
        itemEl.style.marginBottom = "8px";
        itemEl.style.cursor = "pointer";
        itemEl.style.backgroundColor = "var(--background-secondary)";

        const radioEl = itemEl.createEl("input", {
            type: "radio",
            attr: { name: "device-action", value },
        });
        radioEl.style.marginTop = "2px";

        const textEl = itemEl.createDiv();
        textEl.createDiv({ text: label }).style.fontWeight = "500";
        textEl.createDiv({
            text: description,
            cls: "setting-item-description",
        }).style.marginTop = "2px";

        // Click on row to select radio
        itemEl.addEventListener("click", (e) => {
            if (e.target !== radioEl) {
                radioEl.checked = true;
                radioEl.dispatchEvent(new Event("change"));
            }
        });

        // Highlight on selection
        radioEl.addEventListener("change", () => {
            container
                .querySelectorAll(".episteme-device-option")
                .forEach((el) => {
                    (el as HTMLElement).style.backgroundColor =
                        "var(--background-secondary)";
                    (el as HTMLElement).style.border = "none";
                });
            if (radioEl.checked) {
                itemEl.style.backgroundColor = "var(--background-modifier-hover)";
                itemEl.style.border =
                    "1px solid var(--interactive-accent)";
            }
        });

        return { itemEl, radioEl };
    }

    /**
     * Render a database item in the import list.
     */
    private renderDatabaseItem(
        container: HTMLElement,
        db: DeviceDatabaseInfo
    ): void {
        const itemEl = container.createDiv({ cls: "episteme-device-db-item" });
        itemEl.style.display = "flex";
        itemEl.style.justifyContent = "space-between";
        itemEl.style.alignItems = "center";
        itemEl.style.padding = "10px 12px";
        itemEl.style.borderRadius = "6px";
        itemEl.style.marginBottom = "4px";
        itemEl.style.cursor = "pointer";
        itemEl.style.backgroundColor = "var(--background-secondary)";
        itemEl.style.transition = "background-color 0.15s ease";

        // Left side: device info
        const infoEl = itemEl.createDiv();
        const headerEl = infoEl.createDiv();
        headerEl.style.display = "flex";
        headerEl.style.alignItems = "center";
        headerEl.style.gap = "8px";

        headerEl.createSpan({ text: "📱" });
        headerEl.createSpan({
            text: db.deviceId,
            cls: "episteme-device-id",
        }).style.fontFamily = "monospace";

        // Card count and last review
        const statsEl = infoEl.createDiv();
        statsEl.style.fontSize = "0.85em";
        statsEl.style.color = "var(--text-muted)";
        statsEl.style.marginTop = "4px";

        const statsParts: string[] = [];
        if (db.cardCount !== null) {
            statsParts.push(`${db.cardCount.toLocaleString()} cards`);
        }
        if (db.lastReviewDate) {
            statsParts.push(`Last: ${this.formatDate(db.lastReviewDate)}`);
        }
        statsEl.textContent = statsParts.join(" | ");

        // Right side: size and modification date
        const rightEl = itemEl.createDiv();
        rightEl.style.textAlign = "right";
        rightEl.style.fontSize = "0.85em";
        rightEl.style.color = "var(--text-muted)";

        rightEl.createDiv({ text: db.formattedSize });
        rightEl.createDiv({ text: `Mod: ${this.formatRelativeTime(db.lastModified)}` });

        // Selection handling
        itemEl.addEventListener("click", () => {
            // Remove selection from all items
            container.querySelectorAll(".episteme-device-db-item").forEach((el) => {
                (el as HTMLElement).style.backgroundColor =
                    "var(--background-secondary)";
                (el as HTMLElement).style.border = "none";
            });

            // Select this item
            itemEl.style.backgroundColor = "var(--interactive-accent)";
            itemEl.style.border = "2px solid var(--interactive-accent-hover)";
            this.selectedDatabase = db;
            this.updateContinueButton();
        });

        // Hover effect
        itemEl.addEventListener("mouseenter", () => {
            if (this.selectedDatabase !== db) {
                itemEl.style.backgroundColor = "var(--background-modifier-hover)";
            }
        });
        itemEl.addEventListener("mouseleave", () => {
            if (this.selectedDatabase !== db) {
                itemEl.style.backgroundColor = "var(--background-secondary)";
            }
        });
    }

    /**
     * Update the continue button state.
     */
    private updateContinueButton(): void {
        if (!this.continueButton) return;

        // Enable button if:
        // - Fresh action is selected, OR
        // - Import action is selected AND a database is selected
        const canContinue =
            this.selectedAction === "fresh" ||
            (this.selectedAction === "import" && this.selectedDatabase !== null);

        this.continueButton.disabled = !canContinue;
    }

    /**
     * Handle continue button click.
     */
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

    /**
     * Format date for display.
     */
    private formatDate(date: Date): string {
        return date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
        });
    }

    /**
     * Format relative time for display.
     */
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
