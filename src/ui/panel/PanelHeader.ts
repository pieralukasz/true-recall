/**
 * Panel Header Component
 * Displays card count, FSRS status counts, and action icons
 */
import { Menu } from "obsidian";
import { State } from "ts-fsrs";
import { BaseComponent } from "../component.base";
import type { FlashcardInfo } from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import type { SelectionMode } from "../../state/state.types";

export interface PanelHeaderProps {
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
    onExitSelectionMode?: () => void;
}

interface StatusCounts {
    new: number;
    learning: number;
    review: number;
}

/**
 * Panel header component with stats and actions
 */
export class PanelHeader extends BaseComponent {
    private props: PanelHeaderProps;

    constructor(container: HTMLElement, props: PanelHeaderProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        this.element = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-1 ep:border-b ep:border-obs-border",
        });

        if (this.props.selectionMode === "selecting") {
            this.renderSelectionHeader();
        } else {
            this.renderNormalHeader();
        }
    }

    private renderNormalHeader(): void {
        if (!this.element) return;

        // Left side: stats
        const statsEl = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:text-sm",
        });

        const cardCount = this.props.flashcardInfo?.cardCount ?? 0;
        statsEl.createSpan({
            text: `${cardCount} card${cardCount !== 1 ? "s" : ""}`,
            cls: "ep:text-obs-normal ep:font-medium",
        });

        // FSRS status counts
        if (this.props.cardsWithFsrs && this.props.cardsWithFsrs.length > 0) {
            const counts = this.countByState(this.props.cardsWithFsrs);
            const countsEl = statsEl.createSpan({
                cls: "ep:flex ep:items-center ep:gap-1.5 ep:text-xs",
            });

            if (counts.new > 0) {
                countsEl.createSpan({
                    text: `🔵${counts.new}`,
                    cls: "ep:text-obs-muted",
                    attr: { title: "New" },
                });
            }
            if (counts.learning > 0) {
                countsEl.createSpan({
                    text: `🟠${counts.learning}`,
                    cls: "ep:text-obs-muted",
                    attr: { title: "Learning" },
                });
            }
            if (counts.review > 0) {
                countsEl.createSpan({
                    text: `🟢${counts.review}`,
                    cls: "ep:text-obs-muted",
                    attr: { title: "Review" },
                });
            }
        }

        // Right side: action icons
        const actionsEl = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-0.5",
        });

        const iconCls = "clickable-icon";

        // Collect button (pulsing when available)
        if (this.props.hasUncollectedFlashcards && this.props.onCollect) {
            const collectBtn = actionsEl.createEl("button", {
                cls: `${iconCls} episteme-pulse-collect`,
                attr: {
                    "aria-label": `Collect ${this.props.uncollectedCount} flashcards`,
                    title: `Collect (${this.props.uncollectedCount})`,
                },
            });
            collectBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
            this.events.addEventListener(collectBtn, "click", () => this.props.onCollect?.());
        }

        // Add button
        if (this.props.onAdd) {
            const addBtn = actionsEl.createEl("button", {
                cls: iconCls,
                attr: { "aria-label": "Add flashcard", title: "Add" },
            });
            addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
            this.events.addEventListener(addBtn, "click", () => this.props.onAdd?.());
        }

        // More menu button
        const menuBtn = actionsEl.createEl("button", {
            cls: iconCls,
            attr: { "aria-label": "More actions", title: "More" },
        });
        menuBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;
        this.events.addEventListener(menuBtn, "click", (e) => this.showMoreMenu(e));
    }

    private renderSelectionHeader(): void {
        if (!this.element) return;

        // Left side: stats (same as normal)
        const statsEl = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:text-sm",
        });

        const cardCount = this.props.flashcardInfo?.cardCount ?? 0;
        statsEl.createSpan({
            text: `${cardCount} card${cardCount !== 1 ? "s" : ""}`,
            cls: "ep:text-obs-normal ep:font-medium",
        });

        // Right side: close button
        const actionsEl = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-0.5",
        });

        const closeBtn = actionsEl.createEl("button", {
            cls: "clickable-icon",
            attr: { "aria-label": "Exit selection mode", title: "Cancel" },
        });
        closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        this.events.addEventListener(closeBtn, "click", () => this.props.onExitSelectionMode?.());
    }

    private showMoreMenu(e: MouseEvent): void {
        const menu = new Menu();

        const hasFlashcards = (this.props.flashcardInfo?.cardCount ?? 0) > 0;

        if (hasFlashcards && this.props.onUpdate) {
            menu.addItem((item) => {
                item.setTitle("Update flashcards")
                    .setIcon("refresh-cw")
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

    updateProps(props: Partial<PanelHeaderProps>): void {
        this.props = { ...this.props, ...props };
        this.render();
    }
}

export function createPanelHeader(
    container: HTMLElement,
    props: PanelHeaderProps
): PanelHeader {
    const header = new PanelHeader(container, props);
    header.render();
    return header;
}
