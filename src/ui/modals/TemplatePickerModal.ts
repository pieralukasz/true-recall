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
            cls: "ep:text-obs-muted ep:text-sm ep:mb-4",
        });

        // Variables reference
        const variablesEl = container.createDiv({ cls: "ep:mb-3 ep:p-2 ep:bg-obs-secondary ep:rounded ep:text-sm" });
        variablesEl.createEl("strong", { text: "Available variables: " });
        variablesEl.createSpan({
            text: "{{question}}, {{answer}}, {{source}}, {{date}}, {{time}}, {{datetime}}, {{card_id}}",
            cls: "ep:text-obs-muted ep:font-mono ep:text-xs",
        });

        // Clear selection button
        const clearBtn = container.createEl("button", {
            text: "Use Default Template",
            cls: "ep:mb-3 ep:py-2 ep:px-4 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-sm ep:transition-colors ep:hover:bg-obs-modifier-hover",
        });
        clearBtn.addEventListener("click", () => {
            this.selectTemplate(null);
        });

        // Search input
        this.renderSearchInput(container);

        // Template list
        this.templateListEl = container.createDiv({ cls: "ep:border ep:border-obs-border ep:rounded-md ep:max-h-[350px] ep:overflow-y-auto" });
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
        const searchContainer = container.createDiv({ cls: "ep:mb-3" });

        const searchInput = searchContainer.createEl("input", {
            type: "text",
            placeholder: "Search templates...",
            cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-sm ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
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
                cls: "ep:py-6 ep:px-4 ep:text-center ep:text-obs-muted ep:italic",
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
                cls: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-sm",
            });
        }
    }

    private renderTemplateItem(container: HTMLElement, file: TFile): void {
        const itemEl = container.createDiv({ cls: "ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:last:border-b-0 ep:group" });

        // File icon and name
        const infoEl = itemEl.createDiv({ cls: "ep:flex ep:items-center ep:gap-2 ep:overflow-hidden ep:flex-1" });
        infoEl.createSpan({ cls: "ep:shrink-0", text: "📄" });
        infoEl.createSpan({ cls: "ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap", text: file.basename });

        // Folder path (if not in root)
        const folderPath = file.parent?.path;
        if (folderPath && folderPath !== "/") {
            infoEl.createSpan({
                cls: "ep:text-xs ep:text-obs-muted ep:ml-2",
                text: folderPath,
            });
        }

        // Select button
        const selectBtn = itemEl.createEl("button", {
            text: "Select",
            cls: "ep:shrink-0 ep:py-1 ep:px-3 ep:rounded ep:bg-obs-interactive ep:text-white ep:border-none ep:text-xs ep:cursor-pointer ep:opacity-0 ep:group-hover:opacity-100 ep:hover:opacity-100",
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
