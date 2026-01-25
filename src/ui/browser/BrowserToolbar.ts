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

        // Left side: Search
        const searchSection = this.container.createDiv({
            cls: "ep:flex-1 ep:max-w-[400px]",
        });
        this.renderSearch(searchSection);

        // Center: Stats
        const statsSection = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:text-obs-muted ep:text-[13px] ep:whitespace-nowrap",
        });
        this.renderStats(statsSection);

        // Right side: Actions
        const actionsSection = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:ml-auto",
        });
        this.renderActions(actionsSection);
    }

    private renderSearch(container: HTMLElement): void {
        const searchWrapper = container.createDiv({
            cls: "ep:relative ep:flex ep:items-center",
        });

        // Search icon
        const iconEl = searchWrapper.createSpan({
            cls: "ep:absolute ep:left-2.5 ep:text-obs-muted ep:pointer-events-none ep:flex ep:items-center",
        });
        setIcon(iconEl, "search");

        // Search input
        this.searchInput = searchWrapper.createEl("input", {
            type: "text",
            placeholder: "Search cards... (is:due tag:xxx prop:stability>10)",
            cls: "ep:w-full ep:py-2 ep:pr-8 ep:pl-9 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-[13px] focus:ep:border-obs-interactive focus:ep:outline-none",
            value: this.props.searchQuery,
        });

        this.searchInput.addEventListener("input", () => {
            this.props.onSearchChange(this.searchInput?.value ?? "");
        });

        // Clear button
        if (this.props.searchQuery) {
            const clearBtn = searchWrapper.createSpan({
                cls: "ep:absolute ep:right-2 ep:flex ep:items-center ep:justify-center ep:w-5 ep:h-5 ep:rounded ep:text-obs-muted ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
            });
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
                cls: "ep:font-semibold ep:text-obs-interactive",
            });
            container.createSpan({ text: " · " });
        }

        container.createSpan({
            text: filteredCount === totalCount
                ? `${totalCount} cards`
                : `${filteredCount} of ${totalCount} cards`,
            cls: "ep:text-obs-muted",
        });
    }

    private renderActions(container: HTMLElement): void {
        const { selectedCount } = this.props;

        // Selection actions (always visible)
        const selectionGroup = container.createDiv({
            cls: "ep:flex ep:items-center ep:gap-1",
        });

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
            const bulkGroup = container.createDiv({
                cls: "ep:flex ep:items-center ep:gap-1 ep:relative",
            });

            // Dropdown menu for bulk operations
            const dropdownBtn = bulkGroup.createEl("button", {
                cls: "ep:flex ep:items-center ep:justify-center ep:gap-1.5 ep:py-1.5 ep:px-3 ep:border-none ep:rounded-md ep:bg-obs-modifier-hover ep:text-obs-muted ep:text-[13px] ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-border ep:hover:text-obs-normal",
            });
            setIcon(dropdownBtn, "more-vertical");
            dropdownBtn.createSpan({ text: "Actions" });

            const dropdown = bulkGroup.createDiv({
                cls: "ep:hidden ep:absolute ep:top-full ep:right-0 ep:mt-1 ep:min-w-[160px] ep:p-1 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-lg ep:shadow-s ep:z-[100]",
            });

            this.createDropdownItem(dropdown, "pause", "Suspend", () => {
                this.props.onBulkOperation("suspend");
            });
            this.createDropdownItem(dropdown, "play", "Unsuspend", () => {
                this.props.onBulkOperation("unsuspend");
            });

            dropdown.createDiv({ cls: "ep:h-px ep:my-1 ep:bg-obs-border" });

            this.createDropdownItem(dropdown, "archive", "Bury", () => {
                this.props.onBulkOperation("bury");
            });
            this.createDropdownItem(dropdown, "archive-restore", "Unbury", () => {
                this.props.onBulkOperation("unbury");
            });

            dropdown.createDiv({ cls: "ep:h-px ep:my-1 ep:bg-obs-border" });

            this.createDropdownItem(dropdown, "refresh-cw", "Reset", () => {
                this.props.onBulkOperation("reset");
            });
            this.createDropdownItem(dropdown, "calendar", "Reschedule", () => {
                this.props.onBulkOperation("reschedule");
            });

            dropdown.createDiv({ cls: "ep:h-px ep:my-1 ep:bg-obs-border" });

            this.createDropdownItem(dropdown, "trash-2", "Delete", () => {
                this.props.onBulkOperation("delete");
            }, true);

            // Toggle dropdown on click
            const closeDropdown = (e: MouseEvent) => {
                if (!bulkGroup.contains(e.target as Node)) {
                    dropdown.classList.remove("ep:block");
                    dropdown.classList.add("ep:hidden");
                    document.removeEventListener("click", closeDropdown);
                }
            };

            dropdownBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isHidden = dropdown.classList.contains("ep:hidden");
                if (isHidden) {
                    dropdown.classList.remove("ep:hidden");
                    dropdown.classList.add("ep:block");
                    setTimeout(() => {
                        document.addEventListener("click", closeDropdown);
                    }, 0);
                } else {
                    dropdown.classList.add("ep:hidden");
                    dropdown.classList.remove("ep:block");
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
            cls: "ep:flex ep:items-center ep:justify-center ep:gap-1.5 ep:py-1.5 ep:px-2.5 ep:border-none ep:rounded-md ep:bg-transparent ep:text-obs-muted ep:text-[13px] ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
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
        const baseCls = "ep:flex ep:items-center ep:gap-2 ep:w-full ep:py-2 ep:px-3 ep:rounded ep:text-[13px] ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover";
        const colorCls = isDanger
            ? "ep:text-obs-error ep:hover:bg-red-500/10"
            : "ep:text-obs-normal";

        const item = container.createDiv({
            cls: `${baseCls} ${colorCls}`,
        });

        const iconColorCls = isDanger ? "ep:text-obs-error" : "ep:text-obs-muted";
        const iconEl = item.createSpan({
            cls: `ep:flex ep:items-center ${iconColorCls}`,
        });
        setIcon(iconEl, icon);

        item.createSpan({ text: label, cls: "ep:flex-1" });

        item.addEventListener("click", (e) => {
            e.stopPropagation();
            container.classList.add("ep:hidden");
            container.classList.remove("ep:block");
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
