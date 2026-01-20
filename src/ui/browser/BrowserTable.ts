/**
 * Browser Table
 * Sortable table displaying flashcards with state badges
 */
import { setIcon } from "obsidian";
import { State } from "ts-fsrs";
import type { BrowserCardItem, BrowserColumn, SortDirection } from "../../types/browser.types";

export interface BrowserTableProps {
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

/**
 * Table component for displaying cards
 */
export class BrowserTable {
    private container: HTMLElement;
    private props: BrowserTableProps;

    constructor(container: HTMLElement, props: BrowserTableProps) {
        this.container = container;
        this.props = props;
    }

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

        // Create table
        const table = this.container.createEl("table", { cls: "cards-table" });

        // Header
        const thead = table.createEl("thead");
        this.renderHeader(thead);

        // Body
        const tbody = table.createEl("tbody");
        this.renderRows(tbody);
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

    private renderHeader(thead: HTMLElement): void {
        const tr = thead.createEl("tr");

        for (const col of COLUMNS) {
            const th = tr.createEl("th", {
                cls: `col-${col.key}`,
                attr: { style: `width: ${col.width}` },
            });

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

    private renderRows(tbody: HTMLElement): void {
        for (const card of this.props.cards) {
            const isSelected = this.props.selectedCardIds.has(card.id);
            const tr = tbody.createEl("tr", {
                cls: `card-row${isSelected ? " is-selected" : ""}${this.getRowStateClass(card)}`,
            });

            // Question
            const questionTd = tr.createEl("td", { cls: "col-question" });
            questionTd.createSpan({
                text: this.truncateText(this.stripHtml(card.question ?? ""), 60),
                cls: "cell-content",
            });

            // Answer
            const answerTd = tr.createEl("td", { cls: "col-answer" });
            answerTd.createSpan({
                text: this.truncateText(this.stripHtml(card.answer ?? ""), 50),
                cls: "cell-content",
            });

            // Due
            const dueTd = tr.createEl("td", { cls: "col-due" });
            dueTd.createSpan({
                text: this.formatDue(card.due),
                cls: `cell-content ${this.getDueClass(card.due)}`,
            });

            // State
            const stateTd = tr.createEl("td", { cls: "col-state" });
            this.renderStateBadge(stateTd, card);

            // Stability
            const stabilityTd = tr.createEl("td", { cls: "col-stability" });
            stabilityTd.createSpan({
                text: card.stability > 0 ? `${Math.round(card.stability)}d` : "-",
                cls: "cell-content",
            });

            // Reps
            const repsTd = tr.createEl("td", { cls: "col-reps" });
            repsTd.createSpan({
                text: String(card.reps),
                cls: "cell-content",
            });

            // Lapses
            const lapsesTd = tr.createEl("td", { cls: "col-lapses" });
            lapsesTd.createSpan({
                text: String(card.lapses),
                cls: `cell-content${card.lapses > 3 ? " is-warning" : ""}`,
            });

            // Source
            const sourceTd = tr.createEl("td", { cls: "col-source" });
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
        }
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
            // Check if it's actually due today or in the future
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
        // Remove HTML tags and convert <br> to spaces
        return html
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    destroy(): void {
        // Cleanup if needed
    }
}
