/**
 * Browser Sidebar
 * Filter panel with state and project filters
 */
import { setIcon } from "obsidian";
import { State } from "ts-fsrs";
import type { SidebarFilters } from "../../types/browser.types";
import { BaseComponent } from "./BaseComponent";
import { SIDEBAR_STYLES } from "./styles";

export interface BrowserSidebarProps {
    stateCounts: Record<string, number>;
    projects: string[];
    currentFilters: SidebarFilters;
}

export interface BrowserSidebarCallbacks {
    onFilterChange: (filters: Partial<SidebarFilters>) => void;
    onClearFilters: () => void;
}

interface StateFilterItem {
    key: State | "suspended" | "buried" | null;
    label: string;
    icon: string;
    countKey: string;
}

const STATE_FILTERS: StateFilterItem[] = [
    { key: null, label: "All Cards", icon: "layers", countKey: "all" },
    { key: State.New, label: "New", icon: "star", countKey: "new" },
    { key: State.Learning, label: "Learning", icon: "book-open", countKey: "learning" },
    { key: State.Review, label: "Review", icon: "check-circle", countKey: "review" },
    { key: State.Relearning, label: "Relearning", icon: "refresh-cw", countKey: "relearning" },
    { key: "suspended", label: "Suspended", icon: "pause-circle", countKey: "suspended" },
    { key: "buried", label: "Buried", icon: "archive", countKey: "buried" },
];

/**
 * Sidebar component for filtering cards
 */
export class BrowserSidebar extends BaseComponent<BrowserSidebarProps, BrowserSidebarCallbacks> {
    // Cached DOM references for incremental updates
    private statesContainer: HTMLElement | null = null;
    private projectsContainer: HTMLElement | null = null;
    private headerClearBtn: HTMLElement | null = null;

    constructor(
        container: HTMLElement,
        props: BrowserSidebarProps,
        callbacks: BrowserSidebarCallbacks
    ) {
        super(container, props, callbacks);
    }

    render(): void {
        this.container.empty();

        // Header with clear button
        this.renderHeader();

        // State filters section
        const statesSection = this.container.createDiv({
            cls: SIDEBAR_STYLES.SECTION,
        });
        statesSection.createDiv({
            text: "States",
            cls: SIDEBAR_STYLES.SECTION_TITLE,
        });
        this.statesContainer = statesSection.createDiv({
            cls: SIDEBAR_STYLES.SECTION_CONTENT,
        });
        this.renderStateFilters();

        // Project filters section
        if (this.props.projects.length > 0) {
            const projectsSection = this.container.createDiv({
                cls: SIDEBAR_STYLES.SECTION,
            });
            projectsSection.createDiv({
                text: "Projects",
                cls: SIDEBAR_STYLES.SECTION_TITLE,
            });
            this.projectsContainer = projectsSection.createDiv({
                cls: SIDEBAR_STYLES.SECTION_CONTENT,
            });
            this.renderProjectFilters();
        }

        this.isRendered = true;
    }

    /**
     * Handle incremental updates based on what changed
     */
    protected onUpdate(changedKeys: (keyof BrowserSidebarProps)[]): void {
        const needsStates = changedKeys.some(k =>
            k === "stateCounts" || k === "currentFilters"
        );
        const needsProjects = changedKeys.some(k =>
            k === "projects" || k === "currentFilters"
        );
        const needsHeader = changedKeys.includes("currentFilters");

        if (needsStates && this.statesContainer) {
            this.statesContainer.empty();
            this.renderStateFilters();
        }

        if (needsProjects && this.projectsContainer) {
            this.projectsContainer.empty();
            this.renderProjectFilters();
        }

        if (needsHeader) {
            this.updateHeaderClearButton();
        }
    }

    private renderHeader(): void {
        const header = this.container.createDiv({
            cls: SIDEBAR_STYLES.HEADER,
        });
        header.createSpan({
            text: "Filters",
            cls: SIDEBAR_STYLES.HEADER_TITLE,
        });

        // Clear button container (for updates)
        const clearBtnContainer = header.createDiv();
        this.headerClearBtn = clearBtnContainer;
        this.updateHeaderClearButton();
    }

    private updateHeaderClearButton(): void {
        if (!this.headerClearBtn) return;
        this.headerClearBtn.empty();

        if (this.hasActiveFilters()) {
            const clearBtn = this.headerClearBtn.createEl("button", {
                cls: SIDEBAR_STYLES.HEADER_CLEAR_BTN,
                attr: { "aria-label": "Clear filters" },
            });
            setIcon(clearBtn, "x");
            clearBtn.addEventListener("click", () => this.callbacks.onClearFilters());
        }
    }

    private renderStateFilters(): void {
        if (!this.statesContainer) return;

        const { stateFilter } = this.props.currentFilters;
        const counts = this.props.stateCounts;

        // Calculate total for "All"
        const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

        for (const filter of STATE_FILTERS) {
            const count = filter.countKey === "all" ? total : counts[filter.countKey] ?? 0;
            const isSelected = stateFilter === filter.key;

            const itemCls = isSelected
                ? `${SIDEBAR_STYLES.FILTER_ITEM_BASE} ${SIDEBAR_STYLES.FILTER_ITEM_SELECTED}`
                : `${SIDEBAR_STYLES.FILTER_ITEM_BASE} ${SIDEBAR_STYLES.FILTER_ITEM_DEFAULT}`;

            const item = this.statesContainer.createDiv({ cls: itemCls });

            const iconCls = isSelected
                ? SIDEBAR_STYLES.FILTER_ICON_SELECTED
                : SIDEBAR_STYLES.FILTER_ICON_DEFAULT;
            const iconEl = item.createSpan({ cls: iconCls });
            setIcon(iconEl, filter.icon);

            item.createSpan({
                text: filter.label,
                cls: SIDEBAR_STYLES.FILTER_LABEL,
            });

            const countCls = isSelected
                ? SIDEBAR_STYLES.FILTER_COUNT_SELECTED
                : SIDEBAR_STYLES.FILTER_COUNT_DEFAULT;

            item.createSpan({
                text: String(count),
                cls: countCls,
            });

            item.addEventListener("click", () => {
                this.callbacks.onFilterChange({ stateFilter: filter.key });
            });
        }
    }

    private renderProjectFilters(): void {
        if (!this.projectsContainer) return;

        const { projectFilter } = this.props.currentFilters;

        // "All Projects" option
        const isAllSelected = projectFilter === null;
        const allItemCls = isAllSelected
            ? `${SIDEBAR_STYLES.FILTER_ITEM_BASE} ${SIDEBAR_STYLES.FILTER_ITEM_SELECTED}`
            : `${SIDEBAR_STYLES.FILTER_ITEM_BASE} ${SIDEBAR_STYLES.FILTER_ITEM_DEFAULT}`;

        const allItem = this.projectsContainer.createDiv({ cls: allItemCls });
        const allIconCls = isAllSelected
            ? SIDEBAR_STYLES.FILTER_ICON_SELECTED
            : SIDEBAR_STYLES.FILTER_ICON_DEFAULT;
        const allIcon = allItem.createSpan({ cls: allIconCls });
        setIcon(allIcon, "folder");
        allItem.createSpan({
            text: "All Projects",
            cls: SIDEBAR_STYLES.FILTER_LABEL,
        });
        allItem.addEventListener("click", () => {
            this.callbacks.onFilterChange({ projectFilter: null });
        });

        // Individual projects
        for (const project of this.props.projects) {
            const isSelected = projectFilter === project;
            const itemCls = isSelected
                ? `${SIDEBAR_STYLES.FILTER_ITEM_BASE} ${SIDEBAR_STYLES.FILTER_ITEM_SELECTED}`
                : `${SIDEBAR_STYLES.FILTER_ITEM_BASE} ${SIDEBAR_STYLES.FILTER_ITEM_DEFAULT}`;

            const item = this.projectsContainer.createDiv({ cls: itemCls });

            const iconCls = isSelected
                ? SIDEBAR_STYLES.FILTER_ICON_SELECTED
                : SIDEBAR_STYLES.FILTER_ICON_DEFAULT;
            const iconEl = item.createSpan({ cls: iconCls });
            setIcon(iconEl, "folder-open");

            item.createSpan({
                text: project,
                cls: SIDEBAR_STYLES.FILTER_LABEL,
            });

            item.addEventListener("click", () => {
                this.callbacks.onFilterChange({ projectFilter: project });
            });
        }
    }

    private hasActiveFilters(): boolean {
        const { stateFilter, projectFilter } = this.props.currentFilters;
        return stateFilter !== null || projectFilter !== null;
    }

    override destroy(): void {
        this.statesContainer = null;
        this.projectsContainer = null;
        this.headerClearBtn = null;
        super.destroy();
    }
}
