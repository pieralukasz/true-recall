/**
 * Flashcard Panel Header Component
 * Displays card count, FSRS status counts, and action icons
 */
import { Menu, setIcon } from "obsidian";
import { State } from "ts-fsrs";
import { BaseComponent } from "../component.base";
import { createCardCountDisplay, type CardCountDisplay } from "../components";
import type { FlashcardInfo } from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import type { SelectionMode } from "../../state/state.types";

export interface FlashcardPanelHeaderProps {
    flashcardInfo: FlashcardInfo | null;
    /** Cards with FSRS data for status counting */
    cardsWithFsrs?: FSRSFlashcardItem[];
    hasUncollectedFlashcards: boolean;
    uncollectedCount: number;
    selectionMode: SelectionMode;
    selectedCount: number;
    searchQuery: string;
    onAdd?: () => void;
    onGenerate?: () => void;
    onCollect?: () => void;
    onRefresh?: () => void;
    onReview?: () => void;
    onExitSelectionMode?: () => void;
    onSearchChange?: (query: string) => void;
    onExportCsv?: () => void;
    onCopyToClipboard?: () => void;
}

interface StatusCounts {
    new: number;
    learning: number;
    review: number;
}

/**
 * Flashcard panel header component with stats and actions
 */
export class FlashcardPanelHeader extends BaseComponent {
    private props: FlashcardPanelHeaderProps;
    private searchInput: HTMLInputElement | null = null;
    private headerRowContainer: HTMLElement | null = null;

    constructor(container: HTMLElement, props: FlashcardPanelHeaderProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        this.element = this.container.createDiv({
            cls: "ep:flex ep:flex-col ep:gap-2",
        });

        // Header row container (will be re-rendered on updates)
        this.headerRowContainer = this.element.createDiv();
        this.renderHeaderRow();

        // Search input (only in normal mode, created once)
        if (this.props.selectionMode !== "selecting") {
            this.renderSearchInput();
        }
    }

    private renderHeaderRow(): void {
        if (!this.headerRowContainer) return;

        // Clear and re-render header row only
        this.headerRowContainer.empty();

        const headerRow = this.headerRowContainer.createDiv({
            cls: "ep:flex ep:items-center ep:justify-between",
        });

        if (this.props.selectionMode === "selecting") {
            this.renderSelectionHeader(headerRow);
        } else {
            this.renderNormalHeader(headerRow);
        }
    }

    private renderNormalHeader(headerRow: HTMLElement): void {
        // Left side: section label + counts
        const leftSide = headerRow.createDiv({
            cls: "ep:flex ep:items-center ep:gap-3",
        });

        // Section label "Cards" - native Obsidian style (like "Links" panel)
        leftSide.createDiv({
            cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal",
            text: "Cards",
        });

        // Anki-style counts (New · Learning · Due)
        if (this.props.cardsWithFsrs && this.props.cardsWithFsrs.length > 0) {
            const counts = this.countByState(this.props.cardsWithFsrs);
            createCardCountDisplay(leftSide, {
                newCount: counts.new,
                learningCount: counts.learning,
                dueCount: counts.review,
                variant: "full",
                size: "smaller",
                bold: false,
            });
        }

        // Right side: action buttons
        const actionsEl = headerRow.createDiv({
            cls: "ep:flex ep:items-center ep:gap-1",
        });

        const iconBtnCls = "clickable-icon";
        const textBtnCls = "clickable-icon ep:flex ep:items-center ep:gap-1";

        // Collect button (pulsing when available)
        if (this.props.hasUncollectedFlashcards && this.props.onCollect) {
            const collectBtn = actionsEl.createEl("button", {
                cls: `${textBtnCls} true-recall-pulse-collect`,
                attr: {
                    "aria-label": `Collect ${this.props.uncollectedCount} flashcards`,
                },
            });
            setIcon(collectBtn, "download");
            collectBtn.createSpan({ text: String(this.props.uncollectedCount), cls: "ep:text-ui-smaller" });
            this.events.addEventListener(collectBtn, "click", () => this.props.onCollect?.());
        }

        // Add button
        if (this.props.onAdd) {
            const addBtn = actionsEl.createEl("button", {
                cls: iconBtnCls,
                attr: { "aria-label": "Add flashcard" },
            });
            setIcon(addBtn, "plus");
            this.events.addEventListener(addBtn, "click", () => this.props.onAdd?.());
        }

        // More menu button
        const menuBtn = actionsEl.createEl("button", {
            cls: iconBtnCls,
            attr: { "aria-label": "More actions" },
        });
        setIcon(menuBtn, "more-vertical");
        this.events.addEventListener(menuBtn, "click", (e) => this.showMoreMenu(e));
    }

    private renderSelectionHeader(headerRow: HTMLElement): void {
        // Left side: selection info
        const leftSide = headerRow.createDiv({
            cls: "ep:flex ep:items-center ep:gap-3",
        });

        leftSide.createDiv({
            cls: "ep:text-ui-small ep:font-semibold ep:text-obs-normal",
            text: `${this.props.selectedCount} selected`,
        });

        // Right side: cancel button
        const actionsEl = headerRow.createDiv({
            cls: "ep:flex ep:items-center ep:gap-1",
        });

        const textBtnCls = "clickable-icon ep:flex ep:items-center ep:gap-1";

        const closeBtn = actionsEl.createEl("button", {
            cls: textBtnCls,
            attr: { "aria-label": "Exit selection mode" },
        });
        setIcon(closeBtn, "x");
        closeBtn.createSpan({ text: "Cancel", cls: "ep:text-ui-smaller ep:text-obs-faint" });
        this.events.addEventListener(closeBtn, "click", () => this.props.onExitSelectionMode?.());
    }

    private renderSearchInput(): void {
        if (!this.element || this.searchInput) return;

        const searchContainer = this.element.createDiv();
        this.searchInput = searchContainer.createEl("input", {
            cls: "ep:w-full ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
            type: "text",
            placeholder: "Search flashcards...",
        });
        this.searchInput.value = this.props.searchQuery;

        this.events.addEventListener(this.searchInput, "input", (e) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase();
            this.props.onSearchChange?.(query);
        });
    }

    private showMoreMenu(e: MouseEvent): void {
        const menu = new Menu();

        const hasFlashcards = (this.props.flashcardInfo?.cardCount ?? 0) > 0;

        if (this.props.onRefresh) {
            menu.addItem((item) => {
                item.setTitle("Refresh")
                    .setIcon("refresh-cw")
                    .onClick(() => this.props.onRefresh?.());
            });
        }

        if (hasFlashcards && this.props.onReview) {
            menu.addItem((item) => {
                item.setTitle("Start review")
                    .setIcon("brain")
                    .onClick(() => this.props.onReview?.());
            });
        }

        if (!hasFlashcards && this.props.onGenerate) {
            menu.addItem((item) => {
                item.setTitle("Generate flashcards")
                    .setIcon("sparkles")
                    .onClick(() => this.props.onGenerate?.());
            });
        }

        // Export options (only when flashcards exist)
        if (hasFlashcards) {
            menu.addSeparator();

            if (this.props.onCopyToClipboard) {
                menu.addItem((item) => {
                    item.setTitle("Copy to clipboard")
                        .setIcon("clipboard-copy")
                        .onClick(() => this.props.onCopyToClipboard?.());
                });
            }

            if (this.props.onExportCsv) {
                menu.addItem((item) => {
                    item.setTitle("Export as CSV")
                        .setIcon("file-down")
                        .onClick(() => this.props.onExportCsv?.());
                });
            }
        }

        menu.showAtMouseEvent(e);
    }

    private countByState(cards: FSRSFlashcardItem[]): StatusCounts {
        const counts: StatusCounts = { new: 0, learning: 0, review: 0 };
        for (const card of cards) {
            switch (card.fsrs.state) {
                case State.New:
                    counts.new++;
                    break;
                case State.Learning:
                case State.Relearning:
                    counts.learning++;
                    break;
                case State.Review:
                    counts.review++;
                    break;
            }
        }
        return counts;
    }

    updateProps(props: Partial<FlashcardPanelHeaderProps>): void {
        this.props = { ...this.props, ...props };
        // Only re-render the header row, preserve search input
        this.renderHeaderRow();
    }
}

export function createFlashcardPanelHeader(
    container: HTMLElement,
    props: FlashcardPanelHeaderProps
): FlashcardPanelHeader {
    const header = new FlashcardPanelHeader(container, props);
    header.render();
    return header;
}
