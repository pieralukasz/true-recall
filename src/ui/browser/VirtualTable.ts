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
import { State } from "ts-fsrs";
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
        this.scrollContainer = this.container.createDiv({ cls: "virtual-scroll-container" });
        this.scrollContainer.style.height = "100%";
        this.scrollContainer.style.overflow = "auto";
        this.scrollContainer.style.position = "relative";

        // Create table wrapper (holds spacers + table)
        this.tableWrapper = this.scrollContainer.createDiv({ cls: "virtual-table-wrapper" });

        // Calculate total height for scroll
        const totalHeight = this.props.cards.length * ROW_HEIGHT;
        this.tableWrapper.style.height = `${totalHeight}px`;
        this.tableWrapper.style.position = "relative";

        // Create the actual table
        const table = this.tableWrapper.createEl("table", { cls: "cards-table" });
        table.style.position = "absolute";
        table.style.top = "0";
        table.style.left = "0";
        table.style.width = "100%";

        // Create header (sticky)
        this.thead = table.createEl("thead");
        this.renderHeader();

        // Create body container
        this.tbody = table.createEl("tbody");

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
        const tr = document.createElement("tr");
        tr.className = `card-row${isSelected ? " is-selected" : ""}${this.getRowStateClass(card)}`;
        tr.dataset.cardId = card.id;
        tr.dataset.index = String(index);
        tr.style.display = "flex";
        tr.style.alignItems = "center";

        // Question
        const questionTd = tr.createEl("td", { cls: "col-question" });
        questionTd.style.width = "30%";
        questionTd.style.flexShrink = "0";
        questionTd.createSpan({
            text: this.truncateText(this.stripHtml(card.question ?? ""), 60),
            cls: "cell-content",
        });

        // Answer
        const answerTd = tr.createEl("td", { cls: "col-answer" });
        answerTd.style.width = "25%";
        answerTd.style.flexShrink = "0";
        answerTd.createSpan({
            text: this.truncateText(this.stripHtml(card.answer ?? ""), 50),
            cls: "cell-content",
        });

        // Due
        const dueTd = tr.createEl("td", { cls: "col-due" });
        dueTd.style.width = "10%";
        dueTd.style.flexShrink = "0";
        dueTd.createSpan({
            text: this.formatDue(card.due),
            cls: `cell-content ${this.getDueClass(card.due)}`,
        });

        // State
        const stateTd = tr.createEl("td", { cls: "col-state" });
        stateTd.style.width = "8%";
        stateTd.style.flexShrink = "0";
        this.renderStateBadge(stateTd, card);

        // Stability
        const stabilityTd = tr.createEl("td", { cls: "col-stability" });
        stabilityTd.style.width = "8%";
        stabilityTd.style.flexShrink = "0";
        stabilityTd.createSpan({
            text: card.stability > 0 ? `${Math.round(card.stability)}d` : "-",
            cls: "cell-content",
        });

        // Reps
        const repsTd = tr.createEl("td", { cls: "col-reps" });
        repsTd.style.width = "6%";
        repsTd.style.flexShrink = "0";
        repsTd.createSpan({
            text: String(card.reps),
            cls: "cell-content",
        });

        // Lapses
        const lapsesTd = tr.createEl("td", { cls: "col-lapses" });
        lapsesTd.style.width = "6%";
        lapsesTd.style.flexShrink = "0";
        lapsesTd.createSpan({
            text: String(card.lapses),
            cls: `cell-content${card.lapses > 3 ? " is-warning" : ""}`,
        });

        // Source
        const sourceTd = tr.createEl("td", { cls: "col-source" });
        sourceTd.style.width = "7%";
        sourceTd.style.flexShrink = "0";
        if (card.sourceNoteName) {
            const sourceLink = sourceTd.createEl("a", {
                text: this.truncateText(card.sourceNoteName, 20),
                cls: "source-link",
                attr: { title: card.sourceNoteName },
            });
            sourceLink.addEventListener("click", (e) => {
                e.stopPropagation();
                this.props.onOpenSourceNote(card);
            });
        } else {
            sourceTd.createSpan({ text: "-", cls: "cell-content muted" });
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

        const tr = this.thead.createEl("tr");
        tr.style.display = "flex";

        for (const col of COLUMNS) {
            const th = tr.createEl("th", {
                cls: `col-${col.key}`,
            });
            th.style.width = col.width;
            th.style.flexShrink = "0";

            if (col.sortable) {
                const sortBtn = th.createEl("button", {
                    cls: "sort-header",
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
        const loading = this.container.createDiv({ cls: "table-loading" });
        loading.createSpan({ text: "Loading cards..." });
    }

    private renderEmpty(): void {
        const empty = this.container.createDiv({ cls: "table-empty" });
        const iconEl = empty.createDiv({ cls: "empty-icon" });
        setIcon(iconEl, "inbox");
        empty.createDiv({ text: "No cards found", cls: "empty-text" });
        empty.createDiv({
            text: "Try adjusting your search or filters",
            cls: "empty-hint",
        });
    }

    private renderStateBadge(container: HTMLElement, card: BrowserCardItem): void {
        const now = new Date();
        let label: string;
        let cls: string;

        if (card.suspended) {
            label = "Suspended";
            cls = "state-suspended";
        } else if (card.buriedUntil && new Date(card.buriedUntil) > now) {
            label = "Buried";
            cls = "state-buried";
        } else {
            switch (card.state) {
                case State.New:
                    label = "New";
                    cls = "state-new";
                    break;
                case State.Learning:
                    label = "Learning";
                    cls = "state-learning";
                    break;
                case State.Review:
                    label = "Review";
                    cls = "state-review";
                    break;
                case State.Relearning:
                    label = "Relearn";
                    cls = "state-relearning";
                    break;
                default:
                    label = "Unknown";
                    cls = "state-unknown";
            }
        }

        container.createSpan({
            text: label,
            cls: `state-badge ${cls}`,
        });
    }

    private getRowStateClass(card: BrowserCardItem): string {
        const now = new Date();
        if (card.suspended) return " row-suspended";
        if (card.buriedUntil && new Date(card.buriedUntil) > now) return " row-buried";
        return "";
    }

    private formatDue(due: string): string {
        const dueDate = new Date(due);
        const now = new Date();
        const diffMs = dueDate.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return diffDays === -1 ? "Yesterday" : `${Math.abs(diffDays)}d ago`;
        } else if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours < 0) {
                return "Today";
            } else if (diffHours < 24) {
                return `${diffHours}h`;
            }
            return "Today";
        } else if (diffDays === 1) {
            return "Tomorrow";
        } else if (diffDays < 7) {
            return `${diffDays}d`;
        } else if (diffDays < 30) {
            return `${Math.floor(diffDays / 7)}w`;
        } else if (diffDays < 365) {
            return `${Math.floor(diffDays / 30)}mo`;
        } else {
            return `${Math.floor(diffDays / 365)}y`;
        }
    }

    private getDueClass(due: string): string {
        const dueDate = new Date(due);
        const now = new Date();
        const diffMs = dueDate.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return "due-overdue";
        if (diffDays === 0) return "due-today";
        return "due-future";
    }

    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3) + "...";
    }

    private stripHtml(html: string): string {
        return html
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
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
