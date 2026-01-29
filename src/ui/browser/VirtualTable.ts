/**
 * VirtualTable - High-performance virtual scrolling table
 *
 * Only renders visible rows plus a buffer, enabling smooth scrolling
 * through 10k+ cards without DOM bloat.
 *
 * Architecture:
 * - Fixed row height (40px) for predictable scroll calculations
 * - Top/bottom spacers to maintain correct scroll height
 * - DOM recycling: reuse row elements, only update content
 * - Buffer rows above/below viewport for smooth scrolling
 */
import { setIcon } from "obsidian";
import { truncateText, stripHtml, formatDueDate, getDueDateStatus } from "../utils";
import { renderStateBadge } from "../components";
import type { BrowserCardItem, BrowserColumn, SortDirection } from "../../types/browser.types";

export interface VirtualTableProps {
    cards: BrowserCardItem[];
    selectedCardIds: Set<string>;
    sortColumn: BrowserColumn;
    sortDirection: SortDirection;
    isLoading: boolean;
    onCardClick: (cardId: string, event: MouseEvent) => void;
    onCardDoubleClick: (card: BrowserCardItem) => void;
    onSortChange: (column: BrowserColumn) => void;
    onOpenSourceNote: (card: BrowserCardItem) => void;
}

interface ColumnDef {
    key: BrowserColumn;
    label: string;
    width: string;
    sortable: boolean;
}

const COLUMNS: ColumnDef[] = [
    { key: "question", label: "Question", width: "30%", sortable: true },
    { key: "answer", label: "Answer", width: "25%", sortable: true },
    { key: "due", label: "Due", width: "10%", sortable: true },
    { key: "state", label: "State", width: "8%", sortable: true },
    { key: "stability", label: "Stability", width: "8%", sortable: true },
    { key: "reps", label: "Reps", width: "6%", sortable: true },
    { key: "lapses", label: "Lapses", width: "6%", sortable: true },
    { key: "source", label: "Source", width: "7%", sortable: true },
];

// Virtual scrolling constants
const ROW_HEIGHT = 40; // px - matches CSS padding + content
const BUFFER_ROWS = 5; // Extra rows above/below viewport

interface VisibleRange {
    start: number;
    end: number;
}

/**
 * Virtual scrolling table for high-performance card browsing
 */
export class VirtualTable {
    private container: HTMLElement;
    private props: VirtualTableProps;

    // DOM elements
    private scrollContainer: HTMLElement | null = null;
    private tableWrapper: HTMLElement | null = null;
    private thead: HTMLElement | null = null;
    private tbody: HTMLElement | null = null;
    private topSpacer: HTMLElement | null = null;
    private bottomSpacer: HTMLElement | null = null;

    // Virtual scrolling state
    private visibleRange: VisibleRange = { start: 0, end: 0 };
    private rowPool: Map<number, HTMLElement> = new Map();
    private rafId: number | null = null;

    // Scroll handler bound reference for cleanup
    private boundScrollHandler: () => void;

    constructor(container: HTMLElement, props: VirtualTableProps) {
        this.container = container;
        this.props = props;
        this.boundScrollHandler = this.handleScroll.bind(this);
    }

    /**
     * Initial render - creates DOM structure
     */
    render(): void {
        this.container.empty();
        this.container.addClass("browser-table");

        if (this.props.isLoading) {
            this.renderLoading();
            return;
        }

        if (this.props.cards.length === 0) {
            this.renderEmpty();
            return;
        }

        // Create scroll container
        this.scrollContainer = this.container.createDiv({
            cls: ["ep:relative", "ep:h-full", "ep:overflow-auto"].join(" "),
        });

        // Create table wrapper (holds spacers + table)
        this.tableWrapper = this.scrollContainer.createDiv({
            cls: ["ep:relative", "ep:w-full"].join(" "),
        });

        // Calculate total height for scroll
        const totalHeight = this.props.cards.length * ROW_HEIGHT;
        this.tableWrapper.style.height = `${totalHeight}px`;

        // Create the actual table
        const table = this.tableWrapper.createEl("table", {
            cls: [
                "ep:absolute", "ep:inset-0", "ep:w-full",
                "[border-collapse:collapse]", "[table-layout:fixed]"
            ].join(" "),
        });

        // Create header (sticky)
        this.thead = table.createEl("thead", {
            cls: ["ep:sticky", "ep:top-0", "ep:z-10", "ep:bg-obs-secondary"].join(" "),
        });
        this.renderHeader();

        // Create body container
        this.tbody = table.createEl("tbody", {
            cls: ["ep:relative", "ep:block"].join(" "),
        });

        // Add scroll listener
        this.scrollContainer.addEventListener("scroll", this.boundScrollHandler, { passive: true });

        // Initial render of visible rows
        this.updateVisibleRows();
    }

    /**
     * Update cards data and re-render visible rows
     */
    setCards(cards: BrowserCardItem[]): void {
        this.props.cards = cards;

        if (this.tableWrapper) {
            // Update total height
            const totalHeight = cards.length * ROW_HEIGHT;
            this.tableWrapper.style.height = `${totalHeight}px`;
        }

        // Clear row pool and re-render
        this.rowPool.clear();
        if (this.tbody) {
            this.tbody.empty();
        }
        this.updateVisibleRows();
    }

    /**
     * Update selection state without full re-render
     */
    updateSelection(selectedCardIds: Set<string>): void {
        this.props.selectedCardIds = selectedCardIds;

        // Ensure visible rows exist (in case pool was cleared)
        if (this.rowPool.size === 0 && this.props.cards.length > 0) {
            this.updateVisibleRows();
        }

        // Update selection classes on visible rows
        for (const [index, rowEl] of this.rowPool) {
            const card = this.props.cards[index];
            if (card) {
                const isSelected = selectedCardIds.has(card.id);
                rowEl.toggleClass("is-selected", isSelected);
            }
        }
    }

    /**
     * Handle scroll events with RAF throttling
     */
    private handleScroll(): void {
        if (this.rafId !== null) {
            return; // Already scheduled
        }

        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.updateVisibleRows();
        });
    }

    /**
     * Calculate which rows should be visible and render them
     */
    private updateVisibleRows(): void {
        if (!this.scrollContainer || !this.tbody || !this.tableWrapper) return;

        const scrollTop = this.scrollContainer.scrollTop;
        const viewportHeight = this.scrollContainer.clientHeight;
        const totalCards = this.props.cards.length;

        // Calculate visible range with buffer
        const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
        const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
        const endIndex = Math.min(totalCards, startIndex + visibleCount);

        const newRange: VisibleRange = { start: startIndex, end: endIndex };

        // Check if range changed significantly
        if (newRange.start === this.visibleRange.start && newRange.end === this.visibleRange.end) {
            return; // No change needed
        }

        this.visibleRange = newRange;

        // Remove rows outside new range
        const rowsToRemove: number[] = [];
        for (const index of this.rowPool.keys()) {
            if (index < startIndex || index >= endIndex) {
                rowsToRemove.push(index);
            }
        }
        for (const index of rowsToRemove) {
            const row = this.rowPool.get(index);
            if (row) {
                row.remove();
                this.rowPool.delete(index);
            }
        }

        // Add/update rows in visible range
        for (let i = startIndex; i < endIndex; i++) {
            const card = this.props.cards[i];
            if (!card) continue;

            let row = this.rowPool.get(i);
            if (!row) {
                // Create new row
                row = this.createRow(card, i);
                this.rowPool.set(i, row);
                this.tbody.appendChild(row);
            }

            // Position row absolutely
            row.style.position = "absolute";
            row.style.top = `${i * ROW_HEIGHT}px`;
            row.style.left = "0";
            row.style.right = "0";
            row.style.height = `${ROW_HEIGHT}px`;
        }
    }

    /**
     * Create a single table row for a card
     */
    private createRow(card: BrowserCardItem, index: number): HTMLElement {
        const isSelected = this.props.selectedCardIds.has(card.id);
        const rowStateClass = this.getRowStateClass(card);
        const tr = document.createElement("tr");

        // Build base classes
        const baseClasses = [
            "ep:absolute", "ep:flex", "ep:items-center", "ep:w-full",
            "ep:border-b", "ep:border-obs-border",
            "ep:transition-colors", "ep:duration-100", "ep:cursor-pointer",
            "ep:hover:bg-obs-modifier-hover",
        ];

        if (isSelected) {
            baseClasses.push(
                "ep:bg-[rgba(var(--obs-interactive-rgb),0.1)]",
                "ep:hover:!bg-[rgba(var(--obs-interactive-rgb),0.15)]"
            );
        }

        if (rowStateClass.includes("row-suspended")) {
            baseClasses.push("ep:opacity-60");
        }
        if (rowStateClass.includes("row-buried")) {
            baseClasses.push("ep:opacity-60", "ep:italic");
        }

        tr.className = baseClasses.join(" ");
        tr.dataset.cardId = card.id;
        tr.dataset.index = String(index);
        tr.style.top = `${index * ROW_HEIGHT}px`;
        tr.style.left = "0";
        tr.style.right = "0";
        tr.style.height = `${ROW_HEIGHT}px`;

        const tdClasses = ["ep:py-2.5", "ep:px-3", "ep:text-obs-normal", "ep:overflow-hidden", "ep:text-ellipsis", "ep:whitespace-nowrap"];
        const cellContentClasses = ["ep:block", "ep:overflow-hidden", "ep:text-ellipsis", "ep:whitespace-nowrap"];

        // Question
        const questionTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        questionTd.style.width = "30%";
        questionTd.style.flexShrink = "0";
        questionTd.createSpan({
            text: truncateText(stripHtml(card.question ?? ""), 60),
            cls: cellContentClasses.join(" "),
        });

        // Answer
        const answerTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        answerTd.style.width = "25%";
        answerTd.style.flexShrink = "0";
        answerTd.createSpan({
            text: truncateText(stripHtml(card.answer ?? ""), 50),
            cls: cellContentClasses.join(" "),
        });

        // Due
        const dueTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        dueTd.style.width = "10%";
        dueTd.style.flexShrink = "0";

        const dueClasses = [...cellContentClasses];
        const dueStatus = getDueDateStatus(card.due);
        if (dueStatus === "overdue") dueClasses.push("ep:text-obs-error");
        if (dueStatus === "today") dueClasses.push("ep:text-obs-interactive", "ep:font-medium");

        dueTd.createSpan({
            text: formatDueDate(card.due),
            cls: dueClasses.join(" "),
        });

        // State
        const stateTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        stateTd.style.width = "8%";
        stateTd.style.flexShrink = "0";
        renderStateBadge(stateTd, {
            state: card.state,
            suspended: card.suspended,
            buriedUntil: card.buriedUntil,
        });

        // Stability
        const stabilityTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        stabilityTd.style.width = "8%";
        stabilityTd.style.flexShrink = "0";
        stabilityTd.createSpan({
            text: card.stability > 0 ? `${Math.round(card.stability)}d` : "-",
            cls: cellContentClasses.join(" "),
        });

        // Reps
        const repsTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        repsTd.style.width = "6%";
        repsTd.style.flexShrink = "0";
        repsTd.createSpan({
            text: String(card.reps),
            cls: cellContentClasses.join(" "),
        });

        // Lapses
        const lapsesTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        lapsesTd.style.width = "6%";
        lapsesTd.style.flexShrink = "0";
        const lapsesClasses = [...cellContentClasses];
        if (card.lapses > 3) lapsesClasses.push("ep:text-obs-error");
        lapsesTd.createSpan({
            text: String(card.lapses),
            cls: lapsesClasses.join(" "),
        });

        // Source
        const sourceTd = tr.createEl("td", { cls: tdClasses.join(" ") });
        sourceTd.style.width = "7%";
        sourceTd.style.flexShrink = "0";
        if (card.sourceNoteName) {
            const sourceLink = sourceTd.createEl("a", {
                text: truncateText(card.sourceNoteName, 20),
                cls: ["ep:text-obs-accent", "ep:no-underline", "ep:cursor-pointer", "ep:hover:underline"].join(" "),
                attr: { title: card.sourceNoteName },
            });
            sourceLink.addEventListener("click", (e) => {
                e.stopPropagation();
                this.props.onOpenSourceNote(card);
            });
        } else {
            sourceTd.createSpan({ text: "-", cls: [...cellContentClasses, "ep:text-obs-muted"].join(" ") });
        }

        // Row click handlers
        tr.addEventListener("click", (e) => {
            this.props.onCardClick(card.id, e);
        });

        tr.addEventListener("dblclick", () => {
            this.props.onCardDoubleClick(card);
        });

        return tr;
    }

    /**
     * Render the table header
     */
    private renderHeader(): void {
        if (!this.thead) return;
        this.thead.empty();

        const tr = this.thead.createEl("tr", {
            cls: ["ep:flex"].join(" "),
        });

        for (const col of COLUMNS) {
            const th = tr.createEl("th", {
                cls: [
                    "ep:py-2.5", "ep:px-3", "ep:text-left", "ep:font-semibold",
                    "ep:text-obs-muted", "ep:text-ui-smaller", "ep:uppercase",
                    "ep:tracking-wider", "ep:border-b", "ep:border-obs-border",
                    "ep:whitespace-nowrap", "ep:select-none",
                    "ep:hover:bg-obs-modifier-hover"
                ].join(" "),
            });
            th.style.width = col.width;
            th.style.flexShrink = "0";

            if (col.sortable) {
                const sortBtn = th.createEl("button", {
                    cls: [
                        "ep:flex", "ep:items-center", "ep:gap-1",
                        "ep:bg-transparent", "ep:border-0", "ep:p-0",
                        "ep:cursor-pointer", "ep:text-inherit", "ep:font-inherit"
                    ].join(" "),
                });

                sortBtn.createSpan({ text: col.label });

                // Sort indicator
                if (this.props.sortColumn === col.key) {
                    const sortIcon = sortBtn.createSpan({ cls: "sort-icon" });
                    setIcon(sortIcon, this.props.sortDirection === "asc" ? "chevron-up" : "chevron-down");
                }

                sortBtn.addEventListener("click", () => {
                    this.props.onSortChange(col.key);
                });
            } else {
                th.createSpan({ text: col.label });
            }
        }
    }

    private renderLoading(): void {
        const loading = this.container.createDiv({
            cls: [
                "ep:flex", "ep:flex-col", "ep:items-center", "ep:justify-center",
                "ep:py-15", "ep:px-5", "ep:text-obs-muted", "ep:text-center", "ep:h-full"
            ].join(" "),
        });
        loading.createSpan({ text: "Loading cards..." });
    }

    private renderEmpty(): void {
        const empty = this.container.createDiv({
            cls: [
                "ep:flex", "ep:flex-col", "ep:items-center", "ep:justify-center",
                "ep:py-15", "ep:px-5", "ep:text-obs-muted", "ep:text-center", "ep:h-full"
            ].join(" "),
        });
        const iconEl = empty.createDiv({
            cls: ["ep:text-5xl", "ep:mb-4", "ep:opacity-50"].join(" "),
        });
        setIcon(iconEl, "inbox");
        empty.createDiv({
            text: "No cards found",
            cls: ["ep:text-ui-small", "ep:mb-2"].join(" "),
        });
        empty.createDiv({
            text: "Try adjusting your search or filters",
            cls: ["ep:text-ui-smaller", "ep:opacity-70"].join(" "),
        });
    }

    private getRowStateClass(card: BrowserCardItem): string {
        const now = new Date();
        if (card.suspended) return " row-suspended";
        if (card.buriedUntil && new Date(card.buriedUntil) > now) return " row-buried";
        return "";
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.scrollContainer) {
            this.scrollContainer.removeEventListener("scroll", this.boundScrollHandler);
        }

        this.rowPool.clear();
        this.scrollContainer = null;
        this.tableWrapper = null;
        this.thead = null;
        this.tbody = null;
    }
}
