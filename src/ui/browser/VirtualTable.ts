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
import { TABLE_STYLES } from "./styles";

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

    // Single AbortController for all row events (reused across renders)
    private rowEventController: AbortController | null = null;

    // Scroll handler bound reference for cleanup
    private boundScrollHandler: () => void;

    // Keyboard navigation
    private focusedIndex: number = -1;
    private boundKeyHandler: (e: KeyboardEvent) => void;

    constructor(container: HTMLElement, props: VirtualTableProps) {
        this.container = container;
        this.props = props;
        this.boundScrollHandler = this.handleScroll.bind(this);
        this.boundKeyHandler = this.handleKeyDown.bind(this);
    }

    /**
     * Initial render - creates DOM structure
     */
    render(): void {
        this.container.empty();
        this.container.addClass("browser-table");

        // Reset event controller for fresh render
        this.rowEventController?.abort();
        this.rowEventController = new AbortController();

        if (this.props.isLoading) {
            this.renderLoading();
            return;
        }

        if (this.props.cards.length === 0) {
            this.renderEmpty();
            return;
        }

        // Create scroll container with keyboard focus support
        this.scrollContainer = this.container.createDiv({
            cls: TABLE_STYLES.SCROLL_CONTAINER,
            attr: { tabindex: "0" },
        });

        // Create table wrapper (holds spacers + table)
        this.tableWrapper = this.scrollContainer.createDiv({
            cls: TABLE_STYLES.TABLE_WRAPPER,
        });

        // Calculate total height for scroll
        const totalHeight = this.props.cards.length * ROW_HEIGHT;
        this.tableWrapper.style.height = `${totalHeight}px`;

        // Create the actual table
        const table = this.tableWrapper.createEl("table", {
            cls: TABLE_STYLES.TABLE,
        });

        // Create header (sticky)
        this.thead = table.createEl("thead", {
            cls: TABLE_STYLES.THEAD,
        });
        this.renderHeader();

        // Create body container
        this.tbody = table.createEl("tbody", {
            cls: TABLE_STYLES.TBODY,
        });

        // Add scroll listener
        this.scrollContainer.addEventListener("scroll", this.boundScrollHandler, { passive: true });

        // Add keyboard listener for navigation
        this.scrollContainer.addEventListener("keydown", this.boundKeyHandler);

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

        // Reset event controller and clear row pool
        this.rowEventController?.abort();
        this.rowEventController = new AbortController();
        this.rowPool.clear();

        if (this.tbody) {
            this.tbody.empty();
        }

        // Clamp focused index to new card count
        if (this.focusedIndex >= cards.length) {
            this.focusedIndex = cards.length - 1;
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
        if (!this.scrollContainer || !this.tbody || !this.tableWrapper || !this.rowEventController) return;

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

        // Use shared abort signal for all rows
        const signal = this.rowEventController.signal;

        // Add/update rows in visible range
        for (let i = startIndex; i < endIndex; i++) {
            const card = this.props.cards[i];
            if (!card) continue;

            let row = this.rowPool.get(i);
            if (!row) {
                // Create new row with shared signal
                row = this.createRow(card, i, signal);
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
    private createRow(card: BrowserCardItem, index: number, signal: AbortSignal): HTMLElement {
        const isSelected = this.props.selectedCardIds.has(card.id);
        const isFocused = index === this.focusedIndex;
        const tr = document.createElement("tr");

        // Build class list from style constants
        let className = TABLE_STYLES.ROW_BASE;
        if (isSelected) className += ` ${TABLE_STYLES.ROW_SELECTED}`;
        if (isFocused) className += ` ${TABLE_STYLES.ROW_FOCUSED}`;

        // Check card state (use timestamp comparison for performance)
        const now = Date.now();
        if (card.suspended) {
            className += ` ${TABLE_STYLES.ROW_SUSPENDED}`;
        } else if (card.buriedUntil && new Date(card.buriedUntil).getTime() > now) {
            className += ` ${TABLE_STYLES.ROW_BURIED}`;
        }

        tr.className = className;
        tr.dataset.cardId = card.id;
        tr.dataset.index = String(index);
        tr.style.top = `${index * ROW_HEIGHT}px`;
        tr.style.left = "0";
        tr.style.right = "0";
        tr.style.height = `${ROW_HEIGHT}px`;

        // Question
        const questionTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        questionTd.style.width = "30%";
        questionTd.style.flexShrink = "0";
        questionTd.createSpan({
            text: truncateText(stripHtml(card.question ?? ""), 60),
            cls: TABLE_STYLES.CELL_CONTENT,
        });

        // Answer
        const answerTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        answerTd.style.width = "25%";
        answerTd.style.flexShrink = "0";
        answerTd.createSpan({
            text: truncateText(stripHtml(card.answer ?? ""), 50),
            cls: TABLE_STYLES.CELL_CONTENT,
        });

        // Due
        const dueTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        dueTd.style.width = "10%";
        dueTd.style.flexShrink = "0";

        let dueCls = TABLE_STYLES.CELL_CONTENT;
        const dueStatus = getDueDateStatus(card.due);
        if (dueStatus === "overdue") dueCls += ` ${TABLE_STYLES.DUE_OVERDUE}`;
        if (dueStatus === "today") dueCls += ` ${TABLE_STYLES.DUE_TODAY}`;

        dueTd.createSpan({
            text: formatDueDate(card.due),
            cls: dueCls,
        });

        // State
        const stateTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        stateTd.style.width = "8%";
        stateTd.style.flexShrink = "0";
        renderStateBadge(stateTd, {
            state: card.state,
            suspended: card.suspended,
            buriedUntil: card.buriedUntil,
        });

        // Stability
        const stabilityTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        stabilityTd.style.width = "8%";
        stabilityTd.style.flexShrink = "0";
        stabilityTd.createSpan({
            text: card.stability > 0 ? `${Math.round(card.stability)}d` : "-",
            cls: TABLE_STYLES.CELL_CONTENT,
        });

        // Reps
        const repsTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        repsTd.style.width = "6%";
        repsTd.style.flexShrink = "0";
        repsTd.createSpan({
            text: String(card.reps),
            cls: TABLE_STYLES.CELL_CONTENT,
        });

        // Lapses
        const lapsesTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        lapsesTd.style.width = "6%";
        lapsesTd.style.flexShrink = "0";
        const lapsesCls = card.lapses > 3
            ? `${TABLE_STYLES.CELL_CONTENT} ${TABLE_STYLES.LAPSES_HIGH}`
            : TABLE_STYLES.CELL_CONTENT;
        lapsesTd.createSpan({
            text: String(card.lapses),
            cls: lapsesCls,
        });

        // Source
        const sourceTd = tr.createEl("td", { cls: TABLE_STYLES.CELL });
        sourceTd.style.width = "7%";
        sourceTd.style.flexShrink = "0";
        if (card.sourceNoteName) {
            const sourceLink = sourceTd.createEl("a", {
                text: truncateText(card.sourceNoteName, 20),
                cls: TABLE_STYLES.SOURCE_LINK,
                attr: { title: card.sourceNoteName },
            });
            sourceLink.addEventListener("click", (e) => {
                e.stopPropagation();
                this.props.onOpenSourceNote(card);
            }, { signal });
        } else {
            sourceTd.createSpan({ text: "-", cls: `${TABLE_STYLES.CELL_CONTENT} ${TABLE_STYLES.SOURCE_EMPTY}` });
        }

        // Row click handlers
        tr.addEventListener("click", (e) => {
            // Update focused index on click
            this.focusedIndex = index;
            this.props.onCardClick(card.id, e);
        }, { signal });

        tr.addEventListener("dblclick", () => {
            this.props.onCardDoubleClick(card);
        }, { signal });

        return tr;
    }

    /**
     * Render the table header
     */
    private renderHeader(): void {
        if (!this.thead) return;
        this.thead.empty();

        const tr = this.thead.createEl("tr", {
            cls: TABLE_STYLES.HEADER_ROW,
        });

        for (const col of COLUMNS) {
            const th = tr.createEl("th", {
                cls: TABLE_STYLES.HEADER_CELL,
            });
            th.style.width = col.width;
            th.style.flexShrink = "0";

            if (col.sortable) {
                const sortBtn = th.createEl("button", {
                    cls: TABLE_STYLES.SORT_BTN,
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
            cls: TABLE_STYLES.EMPTY_CONTAINER,
        });
        loading.createSpan({ text: "Loading cards..." });
    }

    private renderEmpty(): void {
        const empty = this.container.createDiv({
            cls: TABLE_STYLES.EMPTY_CONTAINER,
        });
        const iconEl = empty.createDiv({
            cls: TABLE_STYLES.EMPTY_ICON,
        });
        setIcon(iconEl, "inbox");
        empty.createDiv({
            text: "No cards found",
            cls: TABLE_STYLES.EMPTY_TITLE,
        });
        empty.createDiv({
            text: "Try adjusting your search or filters",
            cls: TABLE_STYLES.EMPTY_SUBTITLE,
        });
    }

    // ===== Keyboard Navigation =====

    /**
     * Handle keyboard events for navigation
     */
    private handleKeyDown(e: KeyboardEvent): void {
        if (!this.props.cards.length) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                this.moveFocus(1);
                break;
            case "ArrowUp":
                e.preventDefault();
                this.moveFocus(-1);
                break;
            case "Enter":
                if (this.focusedIndex >= 0) {
                    const card = this.props.cards[this.focusedIndex];
                    if (card) this.props.onCardDoubleClick(card);
                }
                break;
            case "Home":
                e.preventDefault();
                this.setFocus(0);
                break;
            case "End":
                e.preventDefault();
                this.setFocus(this.props.cards.length - 1);
                break;
        }
    }

    /**
     * Move focus by delta (positive = down, negative = up)
     */
    private moveFocus(delta: number): void {
        const newIndex = Math.max(0, Math.min(
            this.props.cards.length - 1,
            this.focusedIndex < 0 ? 0 : this.focusedIndex + delta
        ));
        this.setFocus(newIndex);
    }

    /**
     * Set focus to a specific index
     */
    private setFocus(index: number): void {
        if (index < 0 || index >= this.props.cards.length) return;

        const prevFocusedIndex = this.focusedIndex;
        this.focusedIndex = index;

        // Update focus styles on rows
        if (prevFocusedIndex >= 0) {
            const prevRow = this.rowPool.get(prevFocusedIndex);
            if (prevRow) {
                prevRow.classList.remove(...TABLE_STYLES.ROW_FOCUSED.split(" "));
            }
        }

        const currentRow = this.rowPool.get(index);
        if (currentRow) {
            currentRow.classList.add(...TABLE_STYLES.ROW_FOCUSED.split(" "));
        }

        // Select the focused card
        const card = this.props.cards[index];
        if (card) {
            // Create a synthetic mouse event for selection
            this.props.onCardClick(card.id, {
                shiftKey: false,
                ctrlKey: false,
                metaKey: false,
            } as MouseEvent);
        }

        // Scroll to keep focused row visible
        this.scrollToIndex(index);
    }

    /**
     * Scroll to ensure a row is visible
     */
    private scrollToIndex(index: number): void {
        if (!this.scrollContainer) return;

        const rowTop = index * ROW_HEIGHT;
        const rowBottom = rowTop + ROW_HEIGHT;
        const viewTop = this.scrollContainer.scrollTop;
        const viewBottom = viewTop + this.scrollContainer.clientHeight;

        if (rowTop < viewTop) {
            this.scrollContainer.scrollTop = rowTop;
        } else if (rowBottom > viewBottom) {
            this.scrollContainer.scrollTop = rowBottom - this.scrollContainer.clientHeight;
        }
    }

    /**
     * Set focused index from external click
     */
    setFocusedIndex(index: number): void {
        this.focusedIndex = index;
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
            this.scrollContainer.removeEventListener("keydown", this.boundKeyHandler);
        }

        // Abort all row event listeners with single controller
        this.rowEventController?.abort();
        this.rowEventController = null;

        this.rowPool.clear();
        this.focusedIndex = -1;
        this.scrollContainer = null;
        this.tableWrapper = null;
        this.thead = null;
        this.tbody = null;
    }
}
