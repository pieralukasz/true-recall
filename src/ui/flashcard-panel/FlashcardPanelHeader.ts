/**
 * Flashcard Panel Header Component
 * Displays card count, FSRS status counts, and action icons
 */
import { Menu, setIcon } from "obsidian";
import { State } from "ts-fsrs";
import { BaseComponent } from "../component.base";
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
    onAdd?: () => void;
    onGenerate?: () => void;
    onUpdate?: () => void;
    onCollect?: () => void;
    onRefresh?: () => void;
    onExitSelectionMode?: () => void;
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
            cls: "ep:flex ep:items-center ep:justify-between",
        });

        if (this.props.selectionMode === "selecting") {
            this.renderSelectionHeader();
        } else {
            this.renderNormalHeader();
        }
    }

    private renderNormalHeader(): void {
        if (!this.element) return;

        // Left side: section label + counts
        const leftSide = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-3",
        });

        // Section label "Cards"
        leftSide.createDiv({
            cls: "ep:text-xs ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide",
            text: "Cards",
        });

        // Anki-style counts (New · Learning · Due)
        if (this.props.cardsWithFsrs && this.props.cardsWithFsrs.length > 0) {
            const counts = this.countByState(this.props.cardsWithFsrs);
            const countsEl = leftSide.createSpan({
                cls: "ep:flex ep:items-center ep:gap-1 ep:text-xs ep:font-medium",
            });

            // New count (blue)
            countsEl.createSpan({
                text: String(counts.new),
                cls: "ep:text-blue-500",
            });
            countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

            // Learning count (orange)
            countsEl.createSpan({
                text: String(counts.learning),
                cls: "ep:text-orange-500",
            });
            countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

            // Review count (green)
            countsEl.createSpan({
                text: String(counts.review),
                cls: "ep:text-green-500",
            });
        }

        // Right side: action buttons
        const actionsEl = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-1",
        });

        const btnCls = "ep:inline-flex ep:items-center ep:gap-1 ep:py-1 ep:px-2 ep:border-none ep:rounded ep:bg-obs-modifier-hover ep:text-obs-muted ep:text-xs ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-border ep:hover:text-obs-normal [&_svg]:ep:w-3 [&_svg]:ep:h-3";

        // Collect button (pulsing when available)
        if (this.props.hasUncollectedFlashcards && this.props.onCollect) {
            const collectBtn = actionsEl.createEl("button", {
                cls: `${btnCls} episteme-pulse-collect`,
                attr: {
                    "aria-label": `Collect ${this.props.uncollectedCount} flashcards`,
                },
            });
            setIcon(collectBtn, "download");
            collectBtn.createSpan({ text: String(this.props.uncollectedCount) });
            this.events.addEventListener(collectBtn, "click", () => this.props.onCollect?.());
        }

        // Add button
        if (this.props.onAdd) {
            const addBtn = actionsEl.createEl("button", {
                cls: btnCls,
                attr: { "aria-label": "Add flashcard" },
            });
            setIcon(addBtn, "plus");
            this.events.addEventListener(addBtn, "click", () => this.props.onAdd?.());
        }

        // More menu button
        const menuBtn = actionsEl.createEl("button", {
            cls: btnCls,
            attr: { "aria-label": "More actions" },
        });
        setIcon(menuBtn, "more-vertical");
        this.events.addEventListener(menuBtn, "click", (e) => this.showMoreMenu(e));
    }

    private renderSelectionHeader(): void {
        if (!this.element) return;

        // Left side: selection info
        const leftSide = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-3",
        });

        leftSide.createDiv({
            cls: "ep:text-xs ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide",
            text: `${this.props.selectedCount} selected`,
        });

        // Right side: cancel button
        const actionsEl = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-1",
        });

        const btnCls = "ep:inline-flex ep:items-center ep:gap-1 ep:py-1 ep:px-2 ep:border-none ep:rounded ep:bg-obs-modifier-hover ep:text-obs-muted ep:text-xs ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-border ep:hover:text-obs-normal [&_svg]:ep:w-3 [&_svg]:ep:h-3";

        const closeBtn = actionsEl.createEl("button", {
            cls: btnCls,
            attr: { "aria-label": "Exit selection mode" },
        });
        setIcon(closeBtn, "x");
        closeBtn.createSpan({ text: "Cancel" });
        this.events.addEventListener(closeBtn, "click", () => this.props.onExitSelectionMode?.());
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

        if (hasFlashcards && this.props.onUpdate) {
            menu.addItem((item) => {
                item.setTitle("Update flashcards")
                    .setIcon("sparkles")
                    .onClick(() => this.props.onUpdate?.());
            });
        } else if (this.props.onGenerate) {
            menu.addItem((item) => {
                item.setTitle("Generate flashcards")
                    .setIcon("sparkles")
                    .onClick(() => this.props.onGenerate?.());
            });
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
        this.render();
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
