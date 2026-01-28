/**
 * Template Picker Modal
 * Allows user to select a template file for zettel creation
 */
import { App, TFile } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export interface TemplatePickerResult {
	cancelled: boolean;
	templatePath: string | null;
}

/**
 * Modal for selecting a template file
 */
export class TemplatePickerModal extends BasePromiseModal<TemplatePickerResult> {
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

	protected getDefaultResult(): TemplatePickerResult {
		return { cancelled: true, templatePath: null };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-template-picker-modal");

		// Get all markdown files, prioritizing template folders
		this.allTemplates = this.getTemplateFiles();
	}

	protected renderBody(container: HTMLElement): void {
		// Info text
		container.createEl("p", {
			text: "Select a markdown file to use as a template for creating zettels from flashcards.",
			cls: "ep:text-obs-muted ep:text-ui-small ep:mb-4",
		});

		// Variables reference
		const variablesEl = container.createDiv({
			cls: "ep:mb-3 ep:p-2 ep:bg-obs-secondary ep:rounded ep:text-ui-small",
		});
		variablesEl.createEl("strong", { text: "Available variables: " });
		variablesEl.createSpan({
			text: "{{question}}, {{answer}}, {{source}}, {{date}}, {{time}}, {{datetime}}, {{card_id}}",
			cls: "ep:text-obs-muted ep:font-mono ep:text-ui-smaller",
		});

		// Clear selection button
		const clearBtn = container.createEl("button", {
			text: "Use Default Template",
			cls: "ep:mb-3 ep:py-2 ep:px-4 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-ui-small ep:transition-colors ep:hover:bg-obs-modifier-hover",
		});
		clearBtn.addEventListener("click", () => {
			this.resolve({ cancelled: false, templatePath: null });
		});

		// Search input (using base helper)
		this.createSearchInput(container, "Search templates...", (query) => {
			this.searchQuery = query;
			this.renderTemplateList();
		});

		// Template list (using base helper)
		this.templateListEl = this.createListContainer(container);
		this.renderTemplateList();
	}

	private renderTemplateList(): void {
		if (!this.templateListEl) return;
		this.templateListEl.empty();

		const filteredTemplates = this.filterTemplates();

		if (filteredTemplates.length === 0) {
			const emptyText = this.searchQuery
				? "No templates found matching your search."
				: "No markdown files found.";
			this.createEmptyState(this.templateListEl, emptyText);
			return;
		}

		// Show max 50 files to prevent performance issues
		const displayTemplates = filteredTemplates.slice(0, 50);

		for (const template of displayTemplates) {
			const folderPath = template.parent?.path;
			this.createListItem(
				this.templateListEl,
				{
					name: template.basename,
					description:
						folderPath && folderPath !== "/" ? folderPath : undefined,
				},
				() => this.resolve({ cancelled: false, templatePath: template.path })
			);
		}

		// Show "more results" message if truncated
		if (filteredTemplates.length > 50) {
			this.templateListEl.createEl("div", {
				text: `Showing 50 of ${filteredTemplates.length} files. Type to search for more.`,
				cls: "ep:p-3 ep:text-center ep:text-obs-muted ep:text-ui-small",
			});
		}
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

}
