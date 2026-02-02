/**
 * Browser Toolbar
 * Search bar and bulk action buttons for the card browser
 */
import { setIcon } from "obsidian";
import type { BulkOperation } from "../../types/browser.types";
import { debounce } from "../../utils/event.utils";
import { BaseComponent } from "./BaseComponent";
import { TOOLBAR_STYLES } from "./styles";

/** Search debounce delay in milliseconds */
const SEARCH_DEBOUNCE_MS = 300;

export interface BrowserToolbarProps {
    searchQuery: string;
    selectedCount: number;
    totalCount: number;
    filteredCount: number;
}

export interface BrowserToolbarCallbacks {
    onSearchChange: (query: string) => void;
    onBulkOperation: (operation: BulkOperation) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
}

/**
 * Toolbar component with search and actions
 */
export class BrowserToolbar extends BaseComponent<BrowserToolbarProps, BrowserToolbarCallbacks> {
    private searchInput: HTMLInputElement | null = null;

    // Cached DOM references for incremental updates
    private statsContainer: HTMLElement | null = null;
    private actionsContainer: HTMLElement | null = null;

    /** Debounced search handler to prevent excessive updates while typing */
    private debouncedSearch: (query: string) => void;

    /** Track active document listeners for cleanup */
    private activeDocumentListeners: Array<{
        type: string;
        handler: EventListener;
    }> = [];

    constructor(
        container: HTMLElement,
        props: BrowserToolbarProps,
        callbacks: BrowserToolbarCallbacks
    ) {
        super(container, props, callbacks);

        // Create debounced search function
        this.debouncedSearch = debounce((query: string) => {
            this.callbacks.onSearchChange(query);
        }, SEARCH_DEBOUNCE_MS);
    }

    render(): void {
        this.container.empty();

        // Left side: Search
        const searchSection = this.container.createDiv({
            cls: "ep:flex-1 ep:max-w-[400px]",
        });
        this.renderSearch(searchSection);

        // Center: Stats
        this.statsContainer = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:text-obs-muted ep:text-[13px] ep:whitespace-nowrap",
        });
        this.renderStats();

        // Right side: Actions
        this.actionsContainer = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:ml-auto",
        });
        this.renderActions();

        this.isRendered = true;
    }

    /**
     * Handle incremental updates based on what changed
     */
    protected onUpdate(changedKeys: (keyof BrowserToolbarProps)[]): void {
        const needsStats = changedKeys.some(k =>
            k === "selectedCount" || k === "filteredCount" || k === "totalCount"
        );
        const needsActions = changedKeys.includes("selectedCount");

        if (needsStats && this.statsContainer) {
            this.statsContainer.empty();
            this.renderStats();
        }

        if (needsActions && this.actionsContainer) {
            this.actionsContainer.empty();
            this.renderActions();
        }

        // Update search input if query changed externally
        if (changedKeys.includes("searchQuery") && this.searchInput) {
            if (this.searchInput.value !== this.props.searchQuery) {
                this.searchInput.value = this.props.searchQuery;
            }
        }
    }

    private renderSearch(container: HTMLElement): void {
        const searchWrapper = container.createDiv({
            cls: TOOLBAR_STYLES.SEARCH_WRAPPER,
        });

        // Search icon
        const iconEl = searchWrapper.createSpan({
            cls: TOOLBAR_STYLES.SEARCH_ICON,
        });
        setIcon(iconEl, "search");

        // Search input
        this.searchInput = searchWrapper.createEl("input", {
            type: "text",
            placeholder: "Search cards... (is:due tag:xxx prop:stability>10)",
            cls: TOOLBAR_STYLES.SEARCH_INPUT,
            value: this.props.searchQuery,
        });

        // Use debounced search to avoid excessive updates while typing
        this.searchInput.addEventListener("input", () => {
            this.debouncedSearch(this.searchInput?.value ?? "");
        });

        // Clear button
        if (this.props.searchQuery) {
            const clearBtn = searchWrapper.createSpan({
                cls: TOOLBAR_STYLES.SEARCH_CLEAR,
            });
            setIcon(clearBtn, "x");
            clearBtn.addEventListener("click", () => {
                if (this.searchInput) {
                    this.searchInput.value = "";
                }
                this.callbacks.onSearchChange("");
            });
        }
    }

    private renderStats(): void {
        if (!this.statsContainer) return;

        const { selectedCount, filteredCount, totalCount } = this.props;

        if (selectedCount > 0) {
            this.statsContainer.createSpan({
                text: `${selectedCount} selected`,
                cls: TOOLBAR_STYLES.STATS_SELECTED,
            });
            this.statsContainer.createSpan({ text: " · " });
        }

        this.statsContainer.createSpan({
            text: filteredCount === totalCount
                ? `${totalCount} cards`
                : `${filteredCount} of ${totalCount} cards`,
            cls: TOOLBAR_STYLES.STATS_TEXT,
        });
    }

    private renderActions(): void {
        if (!this.actionsContainer) return;

        const { selectedCount } = this.props;

        // Selection actions (always visible)
        const selectionGroup = this.actionsContainer.createDiv({
            cls: "ep:flex ep:items-center ep:gap-1",
        });

        this.createActionButton(selectionGroup, "check-square", "Select All", () => {
            this.callbacks.onSelectAll();
        });

        if (selectedCount > 0) {
            this.createActionButton(selectionGroup, "square", "Clear Selection", () => {
                this.callbacks.onClearSelection();
            });
        }

        // Bulk actions (only when cards selected)
        if (selectedCount > 0) {
            const bulkGroup = this.actionsContainer.createDiv({
                cls: "ep:flex ep:items-center ep:gap-1 ep:relative",
            });

            // Dropdown menu for bulk operations
            const dropdownBtn = bulkGroup.createEl("button", {
                cls: TOOLBAR_STYLES.ACTION_BTN_FILLED,
            });
            setIcon(dropdownBtn, "more-vertical");
            dropdownBtn.createSpan({ text: "Actions" });

            const dropdown = bulkGroup.createDiv({
                cls: TOOLBAR_STYLES.DROPDOWN,
            });

            this.createDropdownItem(dropdown, "pause", "Suspend", () => {
                this.callbacks.onBulkOperation("suspend");
            });
            this.createDropdownItem(dropdown, "play", "Unsuspend", () => {
                this.callbacks.onBulkOperation("unsuspend");
            });

            dropdown.createDiv({ cls: TOOLBAR_STYLES.DROPDOWN_DIVIDER });

            this.createDropdownItem(dropdown, "archive", "Bury", () => {
                this.callbacks.onBulkOperation("bury");
            });
            this.createDropdownItem(dropdown, "archive-restore", "Unbury", () => {
                this.callbacks.onBulkOperation("unbury");
            });

            dropdown.createDiv({ cls: TOOLBAR_STYLES.DROPDOWN_DIVIDER });

            this.createDropdownItem(dropdown, "refresh-cw", "Reset", () => {
                this.callbacks.onBulkOperation("reset");
            });
            this.createDropdownItem(dropdown, "calendar", "Reschedule", () => {
                this.callbacks.onBulkOperation("reschedule");
            });

            dropdown.createDiv({ cls: TOOLBAR_STYLES.DROPDOWN_DIVIDER });

            this.createDropdownItem(dropdown, "trash-2", "Delete", () => {
                this.callbacks.onBulkOperation("delete");
            }, true);

            // Toggle dropdown on click
            const closeDropdown = (e: MouseEvent) => {
                if (!bulkGroup.contains(e.target as Node)) {
                    dropdown.classList.remove(TOOLBAR_STYLES.DROPDOWN_VISIBLE);
                    dropdown.classList.add("ep:hidden");
                    document.removeEventListener("click", closeDropdown);
                    this.activeDocumentListeners = this.activeDocumentListeners.filter(
                        (l) => l.handler !== closeDropdown
                    );
                }
            };

            dropdownBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isHidden = dropdown.classList.contains("ep:hidden");
                if (isHidden) {
                    dropdown.classList.remove("ep:hidden");
                    dropdown.classList.add(TOOLBAR_STYLES.DROPDOWN_VISIBLE);
                    setTimeout(() => {
                        document.addEventListener("click", closeDropdown);
                        this.activeDocumentListeners.push({
                            type: "click",
                            handler: closeDropdown as EventListener,
                        });
                    }, 0);
                } else {
                    dropdown.classList.add("ep:hidden");
                    dropdown.classList.remove(TOOLBAR_STYLES.DROPDOWN_VISIBLE);
                    document.removeEventListener("click", closeDropdown);
                    this.activeDocumentListeners = this.activeDocumentListeners.filter(
                        (l) => l.handler !== closeDropdown
                    );
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
            cls: TOOLBAR_STYLES.ACTION_BTN,
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
        const colorCls = isDanger
            ? `${TOOLBAR_STYLES.DROPDOWN_ITEM} ${TOOLBAR_STYLES.DROPDOWN_ITEM_DANGER}`
            : TOOLBAR_STYLES.DROPDOWN_ITEM;

        const item = container.createDiv({
            cls: colorCls,
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
            container.classList.remove(TOOLBAR_STYLES.DROPDOWN_VISIBLE);
            onClick();
        });
    }

    /**
     * Focus the search input
     */
    focusSearch(): void {
        this.searchInput?.focus();
    }

    override destroy(): void {
        // Clean up document listeners
        for (const { type, handler } of this.activeDocumentListeners) {
            document.removeEventListener(type, handler);
        }
        this.activeDocumentListeners = [];

        this.searchInput = null;
        this.statsContainer = null;
        this.actionsContainer = null;

        super.destroy();
    }
}
