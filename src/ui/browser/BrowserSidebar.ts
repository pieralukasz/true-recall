/**
 * Browser Sidebar
 * Filter panel with state, project, and tag filters
 */
import { setIcon } from "obsidian";
import { State } from "ts-fsrs";
import type { SidebarFilters } from "../../types/browser.types";

export interface BrowserSidebarProps {
    stateCounts: Record<string, number>;
    projects: string[];
    tags: string[];
    currentFilters: SidebarFilters;
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
export class BrowserSidebar {
    private container: HTMLElement;
    private props: BrowserSidebarProps;

    constructor(container: HTMLElement, props: BrowserSidebarProps) {
        this.container = container;
        this.props = props;
    }

    render(): void {
        this.container.empty();
        this.container.addClass("browser-sidebar");

        // Header with clear button
        const header = this.container.createDiv({ cls: "sidebar-header" });
        header.createSpan({ text: "Filters", cls: "sidebar-title" });

        if (this.hasActiveFilters()) {
            const clearBtn = header.createEl("button", {
                cls: "sidebar-clear-btn",
                attr: { "aria-label": "Clear filters" },
            });
            setIcon(clearBtn, "x");
            clearBtn.addEventListener("click", () => this.props.onClearFilters());
        }

        // State filters
        this.renderSection("States", () => this.renderStateFilters());

        // Project filters
        if (this.props.projects.length > 0) {
            this.renderSection("Projects", () => this.renderProjectFilters());
        }

        // Tag filters
        if (this.props.tags.length > 0) {
            this.renderSection("Tags", () => this.renderTagFilters());
        }
    }

    private renderSection(title: string, renderContent: () => void): void {
        const section = this.container.createDiv({ cls: "sidebar-section" });
        section.createDiv({ text: title, cls: "section-title" });
        const content = section.createDiv({ cls: "section-content" });

        // Temporarily change container for renderContent
        const originalContainer = this.container;
        this.container = content;
        renderContent();
        this.container = originalContainer;
    }

    private renderStateFilters(): void {
        const { stateFilter } = this.props.currentFilters;
        const counts = this.props.stateCounts;

        // Calculate total for "All"
        const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

        for (const filter of STATE_FILTERS) {
            const count = filter.countKey === "all" ? total : counts[filter.countKey] ?? 0;
            const isSelected = stateFilter === filter.key;

            const item = this.container.createDiv({
                cls: `filter-item${isSelected ? " is-selected" : ""}`,
            });

            const iconEl = item.createSpan({ cls: "filter-icon" });
            setIcon(iconEl, filter.icon);

            item.createSpan({ text: filter.label, cls: "filter-label" });

            item.createSpan({
                text: String(count),
                cls: "filter-count",
            });

            item.addEventListener("click", () => {
                this.props.onFilterChange({ stateFilter: filter.key });
            });
        }
    }

    private renderProjectFilters(): void {
        const { projectFilter } = this.props.currentFilters;

        // "All Projects" option
        const allItem = this.container.createDiv({
            cls: `filter-item${projectFilter === null ? " is-selected" : ""}`,
        });
        const allIcon = allItem.createSpan({ cls: "filter-icon" });
        setIcon(allIcon, "folder");
        allItem.createSpan({ text: "All Projects", cls: "filter-label" });
        allItem.addEventListener("click", () => {
            this.props.onFilterChange({ projectFilter: null });
        });

        // Individual projects
        for (const project of this.props.projects) {
            const isSelected = projectFilter === project;
            const item = this.container.createDiv({
                cls: `filter-item${isSelected ? " is-selected" : ""}`,
            });

            const iconEl = item.createSpan({ cls: "filter-icon" });
            setIcon(iconEl, "folder-open");

            item.createSpan({ text: project, cls: "filter-label" });

            item.addEventListener("click", () => {
                this.props.onFilterChange({ projectFilter: project });
            });
        }
    }

    private renderTagFilters(): void {
        const { tagFilter } = this.props.currentFilters;

        // "All Tags" option
        const allItem = this.container.createDiv({
            cls: `filter-item${tagFilter === null ? " is-selected" : ""}`,
        });
        const allIcon = allItem.createSpan({ cls: "filter-icon" });
        setIcon(allIcon, "tag");
        allItem.createSpan({ text: "All Tags", cls: "filter-label" });
        allItem.addEventListener("click", () => {
            this.props.onFilterChange({ tagFilter: null });
        });

        // Individual tags
        for (const tag of this.props.tags) {
            const isSelected = tagFilter === tag;
            const item = this.container.createDiv({
                cls: `filter-item${isSelected ? " is-selected" : ""}`,
            });

            const iconEl = item.createSpan({ cls: "filter-icon" });
            setIcon(iconEl, "hash");

            item.createSpan({
                text: tag.replace(/^#/, ""),
                cls: "filter-label",
            });

            item.addEventListener("click", () => {
                this.props.onFilterChange({ tagFilter: tag });
            });
        }
    }

    private hasActiveFilters(): boolean {
        const { stateFilter, projectFilter, tagFilter } = this.props.currentFilters;
        return stateFilter !== null || projectFilter !== null || tagFilter !== null;
    }

    destroy(): void {
        // Cleanup if needed
    }
}
