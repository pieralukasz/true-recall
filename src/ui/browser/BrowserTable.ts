/**
 * Browser Table
 * Sortable table displaying flashcards with state badges
 */
import { setIcon } from "obsidian";
import { truncateText, stripHtml, formatDueDate, getDueDateTailwindClass } from "../utils";
import { renderStateBadge } from "../components";
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

        if (this.props.isLoading) {
            this.renderLoading();
            return;
        }

        if (this.props.cards.length === 0) {
            this.renderEmpty();
            return;
        }

        // Create table wrapper for scrolling
        const wrapper = this.container.createDiv({
            cls: "ep:flex-1 ep:overflow-auto",
        });

        // Create table
        const table = wrapper.createEl("table", {
            cls: "ep:w-full ep:border-collapse ep:text-[13px]",
        });

        // Header
        const thead = table.createEl("thead", {
            cls: "ep:sticky ep:top-0 ep:z-10 ep:bg-obs-secondary",
        });
        this.renderHeader(thead);

        // Body
        const tbody = table.createEl("tbody");
        this.renderRows(tbody);
    }

    private renderLoading(): void {
        const loading = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:justify-center ep:p-10 ep:text-obs-muted",
        });
        loading.createSpan({ text: "Loading cards..." });
    }

    private renderEmpty(): void {
        const empty = this.container.createDiv({
            cls: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:py-[60px] ep:px-5 ep:text-obs-muted ep:text-center",
        });
        const iconEl = empty.createDiv({
            cls: "ep:text-5xl ep:mb-4 ep:opacity-50",
        });
        setIcon(iconEl, "inbox");
        empty.createDiv({
            text: "No cards found",
            cls: "ep:text-ui-small ep:mb-2",
        });
        empty.createDiv({
            text: "Try adjusting your search or filters",
            cls: "ep:text-ui-smaller ep:opacity-70",
        });
    }

    private renderHeader(thead: HTMLElement): void {
        const tr = thead.createEl("tr");

        const thCls = "ep:py-2.5 ep:px-3 ep:text-left ep:font-semibold ep:text-obs-muted ep:text-ui-smaller ep:uppercase ep:tracking-[0.3px] ep:border-b ep:border-obs-border ep:whitespace-nowrap ep:cursor-pointer ep:select-none ep:transition-colors ep:hover:bg-obs-modifier-hover";

        for (const col of COLUMNS) {
            const th = tr.createEl("th", {
                cls: thCls,
                attr: { style: `width: ${col.width}` },
            });

            if (col.sortable) {
                const sortBtn = th.createEl("button", {
                    cls: "ep:inline-flex ep:items-center ep:gap-1 ep:p-0 ep:border-none ep:bg-transparent ep:text-inherit ep:font-inherit ep:cursor-pointer",
                });

                sortBtn.createSpan({ text: col.label });

                // Sort indicator
                if (this.props.sortColumn === col.key) {
                    const sortIcon = sortBtn.createSpan({
                        cls: "ep:inline-flex ep:ml-1 ep:opacity-100 ep:text-obs-interactive",
                    });
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
        const trBaseCls = "ep:border-b ep:border-obs-border ep:transition-colors ep:hover:bg-obs-modifier-hover";
        const trSelectedCls = "ep:bg-obs-interactive/10 ep:hover:bg-obs-interactive/15";
        const tdCls = "ep:py-2.5 ep:px-3 ep:text-obs-normal ep:align-middle";
        const tdTruncateCls = "ep:max-w-[300px] ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap";

        for (const card of this.props.cards) {
            const isSelected = this.props.selectedCardIds.has(card.id);
            const trCls = isSelected
                ? `${trBaseCls} ${trSelectedCls}`
                : trBaseCls;

            const tr = tbody.createEl("tr", { cls: trCls });

            // Question
            const questionTd = tr.createEl("td", { cls: `${tdCls} ${tdTruncateCls}` });
            questionTd.createSpan({
                text: truncateText(stripHtml(card.question ?? ""), 60),
            });

            // Answer
            const answerTd = tr.createEl("td", { cls: `${tdCls} ${tdTruncateCls}` });
            answerTd.createSpan({
                text: truncateText(stripHtml(card.answer ?? ""), 50),
            });

            // Due
            const dueTd = tr.createEl("td", { cls: tdCls });
            dueTd.createSpan({
                text: formatDueDate(card.due),
                cls: getDueDateTailwindClass(card.due),
            });

            // State
            const stateTd = tr.createEl("td", { cls: tdCls });
            renderStateBadge(stateTd, {
                state: card.state,
                suspended: card.suspended,
                buriedUntil: card.buriedUntil,
            });

            // Stability
            const stabilityTd = tr.createEl("td", { cls: tdCls });
            stabilityTd.createSpan({
                text: card.stability > 0 ? `${Math.round(card.stability)}d` : "-",
            });

            // Reps
            const repsTd = tr.createEl("td", { cls: tdCls });
            repsTd.createSpan({
                text: String(card.reps),
            });

            // Lapses
            const lapsesTd = tr.createEl("td", { cls: tdCls });
            const lapseCls = card.lapses > 3 ? "ep:text-obs-error" : "";
            lapsesTd.createSpan({
                text: String(card.lapses),
                cls: lapseCls,
            });

            // Source
            const sourceTd = tr.createEl("td", { cls: tdCls });
            if (card.sourceNoteName) {
                const sourceLink = sourceTd.createEl("a", {
                    text: truncateText(card.sourceNoteName, 20),
                    cls: "ep:text-obs-interactive ep:no-underline ep:cursor-pointer ep:hover:underline",
                    attr: { title: card.sourceNoteName },
                });
                sourceLink.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.props.onOpenSourceNote(card);
                });
            } else {
                sourceTd.createSpan({ text: "-", cls: "ep:text-obs-muted" });
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

    destroy(): void {
        // Cleanup if needed
    }
}
