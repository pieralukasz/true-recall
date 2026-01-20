/**
 * Browser Toolbar
 * Search bar and bulk action buttons for the card browser
 */
import { setIcon } from "obsidian";
import type { BulkOperation } from "../../types/browser.types";

export interface BrowserToolbarProps {
    searchQuery: string;
    selectedCount: number;
    totalCount: number;
    filteredCount: number;
    onSearchChange: (query: string) => void;
    onBulkOperation: (operation: BulkOperation) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
}

/**
 * Toolbar component with search and actions
 */
export class BrowserToolbar {
    private container: HTMLElement;
    private props: BrowserToolbarProps;
    private searchInput: HTMLInputElement | null = null;

    constructor(container: HTMLElement, props: BrowserToolbarProps) {
        this.container = container;
        this.props = props;
    }

    render(): void {
        this.container.empty();
        this.container.addClass("browser-toolbar");

        // Left side: Search
        const searchSection = this.container.createDiv({ cls: "toolbar-search-section" });
        this.renderSearch(searchSection);

        // Center: Stats
        const statsSection = this.container.createDiv({ cls: "toolbar-stats-section" });
        this.renderStats(statsSection);

        // Right side: Actions
        const actionsSection = this.container.createDiv({ cls: "toolbar-actions-section" });
        this.renderActions(actionsSection);
    }

    private renderSearch(container: HTMLElement): void {
        const searchWrapper = container.createDiv({ cls: "search-wrapper" });

        // Search icon
        const iconEl = searchWrapper.createSpan({ cls: "search-icon" });
        setIcon(iconEl, "search");

        // Search input
        this.searchInput = searchWrapper.createEl("input", {
            type: "text",
            placeholder: "Search cards... (is:due tag:xxx prop:stability>10)",
            cls: "search-input",
            value: this.props.searchQuery,
        });

        this.searchInput.addEventListener("input", () => {
            this.props.onSearchChange(this.searchInput?.value ?? "");
        });

        // Clear button
        if (this.props.searchQuery) {
            const clearBtn = searchWrapper.createSpan({ cls: "search-clear" });
            setIcon(clearBtn, "x");
            clearBtn.addEventListener("click", () => {
                if (this.searchInput) {
                    this.searchInput.value = "";
                }
                this.props.onSearchChange("");
            });
        }
    }

    private renderStats(container: HTMLElement): void {
        const { selectedCount, filteredCount, totalCount } = this.props;

        if (selectedCount > 0) {
            container.createSpan({
                text: `${selectedCount} selected`,
                cls: "stats-selected",
            });
            container.createSpan({ text: " · " });
        }

        container.createSpan({
            text: filteredCount === totalCount
                ? `${totalCount} cards`
                : `${filteredCount} of ${totalCount} cards`,
            cls: "stats-count",
        });
    }

    private renderActions(container: HTMLElement): void {
        const { selectedCount } = this.props;

        // Selection actions (always visible)
        const selectionGroup = container.createDiv({ cls: "action-group" });

        this.createActionButton(selectionGroup, "check-square", "Select All", () => {
            this.props.onSelectAll();
        });

        if (selectedCount > 0) {
            this.createActionButton(selectionGroup, "square", "Clear Selection", () => {
                this.props.onClearSelection();
            });
        }

        // Bulk actions (only when cards selected)
        if (selectedCount > 0) {
            const bulkGroup = container.createDiv({ cls: "action-group bulk-actions" });

            // Dropdown menu for bulk operations
            const dropdownBtn = bulkGroup.createEl("button", {
                cls: "action-button dropdown-trigger",
            });
            setIcon(dropdownBtn, "more-vertical");
            dropdownBtn.createSpan({ text: "Actions" });

            const dropdown = bulkGroup.createDiv({ cls: "dropdown-menu" });

            this.createDropdownItem(dropdown, "pause", "Suspend", () => {
                this.props.onBulkOperation("suspend");
            });
            this.createDropdownItem(dropdown, "play", "Unsuspend", () => {
                this.props.onBulkOperation("unsuspend");
            });

            dropdown.createDiv({ cls: "dropdown-divider" });

            this.createDropdownItem(dropdown, "archive", "Bury", () => {
                this.props.onBulkOperation("bury");
            });
            this.createDropdownItem(dropdown, "archive-restore", "Unbury", () => {
                this.props.onBulkOperation("unbury");
            });

            dropdown.createDiv({ cls: "dropdown-divider" });

            this.createDropdownItem(dropdown, "refresh-cw", "Reset", () => {
                this.props.onBulkOperation("reset");
            });
            this.createDropdownItem(dropdown, "calendar", "Reschedule", () => {
                this.props.onBulkOperation("reschedule");
            });

            dropdown.createDiv({ cls: "dropdown-divider" });

            this.createDropdownItem(dropdown, "trash-2", "Delete", () => {
                this.props.onBulkOperation("delete");
            }, true);

            // Toggle dropdown on click
            const closeDropdown = (e: MouseEvent) => {
                if (!bulkGroup.contains(e.target as Node)) {
                    dropdown.classList.remove("is-visible");
                    document.removeEventListener("click", closeDropdown);
                }
            };

            dropdownBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.toggle("is-visible");
                if (isOpen) {
                    // Delay adding listener to avoid immediate trigger
                    setTimeout(() => {
                        document.addEventListener("click", closeDropdown);
                    }, 0);
                } else {
                    document.removeEventListener("click", closeDropdown);
                }
            });
        }
    }

    private createActionButton(
        container: HTMLElement,
        icon: string,
        tooltip: string,
        onClick: () => void
    ): HTMLButtonElement {
        const btn = container.createEl("button", {
            cls: "action-button",
            attr: { "aria-label": tooltip, title: tooltip },
        });
        setIcon(btn, icon);
        btn.addEventListener("click", onClick);
        return btn;
    }

    private createDropdownItem(
        container: HTMLElement,
        icon: string,
        label: string,
        onClick: () => void,
        isDanger = false
    ): void {
        const item = container.createDiv({
            cls: `dropdown-item${isDanger ? " is-danger" : ""}`,
        });

        const iconEl = item.createSpan({ cls: "dropdown-item-icon" });
        setIcon(iconEl, icon);

        item.createSpan({ text: label, cls: "dropdown-item-label" });

        item.addEventListener("click", (e) => {
            e.stopPropagation();
            container.classList.remove("is-visible");
            onClick();
        });
    }

    /**
     * Focus the search input
     */
    focusSearch(): void {
        this.searchInput?.focus();
    }

    destroy(): void {
        // Cleanup if needed
    }
}
