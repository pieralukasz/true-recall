/**
 * Template Picker Modal
 * Allows user to select a template file for zettel creation
 */
import { App, TFile } from "obsidian";
import { BaseModal } from "./BaseModal";

export interface TemplatePickerResult {
    cancelled: boolean;
    templatePath: string | null;
}

/**
 * Modal for selecting a template file
 */
export class TemplatePickerModal extends BaseModal {
    private resolvePromise: ((result: TemplatePickerResult) => void) | null = null;
    private hasSelected = false;

    // Search state
    private searchQuery = "";
    private templateListEl: HTMLElement | null = null;
    private allTemplates: TFile[] = [];

    constructor(app: App) {
        super(app, {
            title: "Select Template",
            width: "500px",
        });
    }

    /**
     * Open modal and return promise with selection result
     */
    async openAndWait(): Promise<TemplatePickerResult> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.open();
        });
    }

    onOpen(): void {
        super.onOpen();
        this.contentEl.addClass("episteme-template-picker-modal");

        // Get all markdown files, prioritizing template folders
        this.allTemplates = this.getTemplateFiles();
    }

    protected renderBody(container: HTMLElement): void {
        // Info text
        container.createEl("p", {
            text: "Select a markdown file to use as a template for creating zettels from flashcards.",
            cls: "episteme-modal-info",
        });

        // Variables reference
        const variablesEl = container.createDiv({ cls: "episteme-template-variables" });
        variablesEl.createEl("strong", { text: "Available variables: " });
        variablesEl.createSpan({
            text: "{{question}}, {{answer}}, {{source}}, {{date}}, {{time}}, {{datetime}}, {{card_id}}",
            cls: "episteme-template-variables-list",
        });

        // Clear selection button
        const clearBtn = container.createEl("button", {
            text: "Use Default Template",
            cls: "episteme-btn episteme-btn-secondary",
        });
        clearBtn.addEventListener("click", () => {
            this.selectTemplate(null);
        });

        // Search input
        this.renderSearchInput(container);

        // Template list
        this.templateListEl = container.createDiv({ cls: "episteme-note-list episteme-template-list" });
        this.renderTemplateList();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        if (!this.hasSelected && this.resolvePromise) {
            this.resolvePromise({ cancelled: true, templatePath: null });
            this.resolvePromise = null;
        }
    }

    private renderSearchInput(container: HTMLElement): void {
        const searchContainer = container.createDiv({ cls: "episteme-search-container" });

        const searchInput = searchContainer.createEl("input", {
            type: "text",
            placeholder: "Search templates...",
            cls: "episteme-search-input",
        });

        searchInput.addEventListener("input", (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderTemplateList();
        });

        // Focus search input
        setTimeout(() => searchInput.focus(), 50);
    }

    private renderTemplateList(): void {
        if (!this.templateListEl) return;
        this.templateListEl.empty();

        const filteredTemplates = this.filterTemplates();

        if (filteredTemplates.length === 0) {
            this.templateListEl.createEl("div", {
                text: this.searchQuery
                    ? "No templates found matching your search."
                    : "No markdown files found.",
                cls: "episteme-note-list-empty",
            });
            return;
        }

        // Show max 50 files to prevent performance issues
        const displayTemplates = filteredTemplates.slice(0, 50);

        for (const template of displayTemplates) {
            this.renderTemplateItem(this.templateListEl, template);
        }

        // Show "more results" message if truncated
        if (filteredTemplates.length > 50) {
            this.templateListEl.createEl("div", {
                text: `Showing 50 of ${filteredTemplates.length} files. Type to search for more.`,
                cls: "episteme-note-list-more",
            });
        }
    }

    private renderTemplateItem(container: HTMLElement, file: TFile): void {
        const itemEl = container.createDiv({ cls: "episteme-note-item" });

        // File icon and name
        const infoEl = itemEl.createDiv({ cls: "episteme-note-info" });
        infoEl.createSpan({ cls: "episteme-note-icon", text: "📄" });
        infoEl.createSpan({ cls: "episteme-note-name", text: file.basename });

        // Folder path (if not in root)
        const folderPath = file.parent?.path;
        if (folderPath && folderPath !== "/") {
            infoEl.createSpan({
                cls: "episteme-note-path",
                text: folderPath,
            });
        }

        // Select button
        const selectBtn = itemEl.createEl("button", {
            text: "Select",
            cls: "episteme-note-select-btn",
        });

        selectBtn.addEventListener("click", () => {
            this.selectTemplate(file.path);
        });

        // Also allow clicking the whole row
        itemEl.addEventListener("click", (e) => {
            if (e.target !== selectBtn) {
                this.selectTemplate(file.path);
            }
        });
    }

    /**
     * Get all markdown files, prioritizing files in template-like folders
     */
    private getTemplateFiles(): TFile[] {
        const files = this.app.vault.getMarkdownFiles();

        // Sort: templates folder first, then alphabetically
        return files.sort((a, b) => {
            const aInTemplates = this.isInTemplateFolder(a.path);
            const bInTemplates = this.isInTemplateFolder(b.path);

            if (aInTemplates && !bInTemplates) return -1;
            if (!aInTemplates && bInTemplates) return 1;

            // Within same category, sort by path
            return a.path.localeCompare(b.path);
        });
    }

    /**
     * Check if a file is in a template-like folder
     */
    private isInTemplateFolder(path: string): boolean {
        const lowerPath = path.toLowerCase();
        return (
            lowerPath.includes("template") ||
            lowerPath.includes("templates") ||
            lowerPath.startsWith("_")
        );
    }

    private filterTemplates(): TFile[] {
        if (!this.searchQuery) {
            return this.allTemplates;
        }

        const query = this.searchQuery.toLowerCase();
        return this.allTemplates
            .filter((file) => {
                return (
                    file.basename.toLowerCase().includes(query) ||
                    file.path.toLowerCase().includes(query)
                );
            })
            .sort((a, b) => {
                // Prioritize exact basename matches
                const aExact = a.basename.toLowerCase().startsWith(query);
                const bExact = b.basename.toLowerCase().startsWith(query);
                if (aExact && !bExact) return -1;
                if (bExact && !aExact) return 1;
                return a.basename.localeCompare(b.basename);
            });
    }

    private selectTemplate(templatePath: string | null): void {
        this.hasSelected = true;
        if (this.resolvePromise) {
            this.resolvePromise({ cancelled: false, templatePath });
            this.resolvePromise = null;
        }
        this.close();
    }
}
