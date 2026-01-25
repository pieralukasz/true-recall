/**
 * Browser Sidebar
 * Filter panel with state and project filters
 */
import { setIcon } from "obsidian";
import { State } from "ts-fsrs";
import type { SidebarFilters } from "../../types/browser.types";

export interface BrowserSidebarProps {
    stateCounts: Record<string, number>;
    projects: string[];
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

        // Header with clear button
        const header = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:justify-between ep:p-3 ep:border-b ep:border-obs-border",
        });
        header.createSpan({
            text: "Filters",
            cls: "ep:text-obs-muted ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.5px]",
        });

        if (this.hasActiveFilters()) {
            const clearBtn = header.createEl("button", {
                cls: "ep:flex ep:items-center ep:justify-center ep:w-5 ep:h-5 ep:p-0 ep:border-none ep:rounded ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal",
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
    }

    private renderSection(title: string, renderContent: () => void): void {
        const section = this.container.createDiv({
            cls: "ep:p-3 ep:border-b ep:border-obs-border last:ep:border-b-0",
        });
        section.createDiv({
            text: title,
            cls: "ep:mb-2 ep:text-obs-muted ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.5px]",
        });
        const content = section.createDiv({
            cls: "ep:flex ep:flex-col ep:gap-0.5",
        });

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

        const itemBaseCls = "ep:flex ep:items-center ep:py-1.5 ep:px-2.5 ep:border-none ep:rounded-md ep:text-[13px] ep:text-left ep:cursor-pointer ep:transition-all";
        const itemDefaultCls = "ep:bg-transparent ep:text-obs-normal ep:hover:bg-obs-modifier-hover";
        const itemSelectedCls = "ep:bg-obs-interactive ep:text-on-accent";

        for (const filter of STATE_FILTERS) {
            const count = filter.countKey === "all" ? total : counts[filter.countKey] ?? 0;
            const isSelected = stateFilter === filter.key;

            const itemCls = isSelected
                ? `${itemBaseCls} ${itemSelectedCls}`
                : `${itemBaseCls} ${itemDefaultCls}`;

            const item = this.container.createDiv({ cls: itemCls });

            const iconCls = isSelected
                ? "ep:shrink-0 ep:mr-2 ep:opacity-100"
                : "ep:shrink-0 ep:mr-2 ep:opacity-70";
            const iconEl = item.createSpan({ cls: iconCls });
            setIcon(iconEl, filter.icon);

            item.createSpan({
                text: filter.label,
                cls: "ep:flex-1 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
            });

            const countCls = isSelected
                ? "ep:shrink-0 ep:ml-2 ep:text-[11px] ep:font-medium ep:py-0.5 ep:px-1.5 ep:bg-white/20 ep:rounded-full ep:text-on-accent"
                : "ep:shrink-0 ep:ml-2 ep:text-[11px] ep:font-medium ep:py-0.5 ep:px-1.5 ep:bg-obs-modifier-hover ep:rounded-full ep:text-obs-muted";

            item.createSpan({
                text: String(count),
                cls: countCls,
            });

            item.addEventListener("click", () => {
                this.props.onFilterChange({ stateFilter: filter.key });
            });
        }
    }

    private renderProjectFilters(): void {
        const { projectFilter } = this.props.currentFilters;

        const itemBaseCls = "ep:flex ep:items-center ep:py-1.5 ep:px-2.5 ep:border-none ep:rounded-md ep:text-[13px] ep:text-left ep:cursor-pointer ep:transition-all";
        const itemDefaultCls = "ep:bg-transparent ep:text-obs-normal ep:hover:bg-obs-modifier-hover";
        const itemSelectedCls = "ep:bg-obs-interactive ep:text-on-accent";

        // "All Projects" option
        const isAllSelected = projectFilter === null;
        const allItemCls = isAllSelected
            ? `${itemBaseCls} ${itemSelectedCls}`
            : `${itemBaseCls} ${itemDefaultCls}`;

        const allItem = this.container.createDiv({ cls: allItemCls });
        const allIconCls = isAllSelected
            ? "ep:shrink-0 ep:mr-2 ep:opacity-100"
            : "ep:shrink-0 ep:mr-2 ep:opacity-70";
        const allIcon = allItem.createSpan({ cls: allIconCls });
        setIcon(allIcon, "folder");
        allItem.createSpan({
            text: "All Projects",
            cls: "ep:flex-1 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
        });
        allItem.addEventListener("click", () => {
            this.props.onFilterChange({ projectFilter: null });
        });

        // Individual projects
        for (const project of this.props.projects) {
            const isSelected = projectFilter === project;
            const itemCls = isSelected
                ? `${itemBaseCls} ${itemSelectedCls}`
                : `${itemBaseCls} ${itemDefaultCls}`;

            const item = this.container.createDiv({ cls: itemCls });

            const iconCls = isSelected
                ? "ep:shrink-0 ep:mr-2 ep:opacity-100"
                : "ep:shrink-0 ep:mr-2 ep:opacity-70";
            const iconEl = item.createSpan({ cls: iconCls });
            setIcon(iconEl, "folder-open");

            item.createSpan({
                text: project,
                cls: "ep:flex-1 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
            });

            item.addEventListener("click", () => {
                this.props.onFilterChange({ projectFilter: project });
            });
        }
    }

    private hasActiveFilters(): boolean {
        const { stateFilter, projectFilter } = this.props.currentFilters;
        return stateFilter !== null || projectFilter !== null;
    }

    destroy(): void {
        // Cleanup if needed
    }
}
