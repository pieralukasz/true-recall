/**
 * Compact Card Item Component
 * Single-line card with status dot, question, and dropdown menu
 * Expands to show answer on click
 */
import { App, Component, Menu, MarkdownRenderer } from "obsidian";
import { State } from "ts-fsrs";
import { BaseComponent } from "../component.base";
import type { FlashcardItem } from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";

export interface CompactCardItemProps {
    card: FlashcardItem;
    /** FSRS data for status indicator (optional) */
    fsrsCard?: FSRSFlashcardItem;
    filePath: string;
    app: App;
    component: Component;
    isExpanded: boolean;
    isSelected: boolean;
    isSelectionMode: boolean;
    onToggleExpand?: () => void;
    onToggleSelect?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onCopy?: () => void;
    onMove?: () => void;
    onSelect?: () => void; // Enter selection mode with this card
    onLongPress?: () => void;
}

const LONG_PRESS_DURATION = 500;

/**
 * Compact card item with expandable answer
 */
export class CompactCardItem extends BaseComponent {
    private props: CompactCardItemProps;
    private longPressTimer: ReturnType<typeof setTimeout> | null = null;
    private didLongPress = false;

    constructor(container: HTMLElement, props: CompactCardItemProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        const { card, isExpanded, isSelected, isSelectionMode, app, filePath, component } = this.props;

        this.element = this.container.createDiv({
            cls: `ep:flex ep:flex-col ep:mb-2 ep:rounded ep:bg-obs-secondary ep:border ep:border-obs-border ${isSelected ? "ep:border-obs-interactive ep:border-2" : ""}`,
        });

        // Main row (always visible)
        const mainRow = this.element.createDiv({
            cls: "ep:flex ep:items-start ep:gap-2 ep:p-2 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded ep:transition-colors",
        });

        // Setup long press for main row
        this.setupLongPress(mainRow);

        // Click handler for expand/collapse or select
        this.events.addEventListener(mainRow, "click", (e) => {
            if (this.didLongPress) {
                this.didLongPress = false;
                return;
            }
            // Don't trigger if clicked on menu button
            if ((e.target as HTMLElement).closest("button")) return;

            // Prevent event bubbling to avoid scroll position reset
            e.stopPropagation();

            if (isSelectionMode) {
                this.props.onToggleSelect?.();
            } else {
                this.props.onToggleExpand?.();
            }
        });

        // Checkbox (only in selection mode)
        if (isSelectionMode) {
            const checkbox = mainRow.createEl("input", {
                type: "checkbox",
                cls: "ep:w-4 ep:h-4 ep:cursor-pointer",
            });
            checkbox.checked = isSelected;
            this.events.addEventListener(checkbox, "click", (e) => {
                e.stopPropagation();
                this.props.onToggleSelect?.();
            });
        }

        // Status dot
        const statusDotEl = mainRow.createSpan({
            cls: "ep:w-2 ep:h-2 ep:rounded-full ep:flex-shrink-0 ep:mt-1.5",
            attr: { title: this.getStatusTitle() },
        });
        statusDotEl.addClass(this.getStatusDotColor());

        // Question (rendered markdown, full content with line breaks)
        const questionEl = mainRow.createDiv({
            cls: "ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown",
        });
        void MarkdownRenderer.render(app, card.question, questionEl, filePath, component);

        // Menu icon
        const menuBtn = mainRow.createEl("button", {
            cls: "clickable-icon",
            attr: { "aria-label": "Card actions" },
        });
        menuBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`;
        this.events.addEventListener(menuBtn, "click", (e) => {
            e.stopPropagation();
            this.showCardMenu(e);
        });

        // Expanded content (answer)
        if (isExpanded) {
            this.renderExpandedContent();
        }
    }

    private renderExpandedContent(): void {
        if (!this.element) return;

        const { card, filePath, app, component } = this.props;

        const answerContainer = this.element.createDiv({
            cls: "ep:pl-6 ep:pr-2 ep:pb-3 ep:pt-2 ep:border-t ep:border-obs-border",
        });

        // Answer content with markdown rendering
        const answerContent = answerContainer.createDiv({
            cls: "ep:text-ui-small ep:text-obs-normal true-recall-panel-card-field",
        });

        void MarkdownRenderer.render(app, card.answer, answerContent, filePath, component);
    }

    private setupLongPress(element: HTMLElement): void {
        this.events.addEventListener(element, "pointerdown", () => {
            this.didLongPress = false;
            this.longPressTimer = setTimeout(() => {
                this.didLongPress = true;
                this.props.onLongPress?.();
            }, LONG_PRESS_DURATION);
        });

        this.events.addEventListener(element, "pointerup", () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });

        this.events.addEventListener(element, "pointerleave", () => {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        });
    }

    private showCardMenu(e: MouseEvent): void {
        const menu = new Menu();

        if (this.props.onEdit) {
            menu.addItem((item) => {
                item.setTitle("Edit")
                    .setIcon("pencil")
                    .onClick(() => this.props.onEdit?.());
            });
        }

        if (this.props.onCopy) {
            menu.addItem((item) => {
                item.setTitle("Copy")
                    .setIcon("copy")
                    .onClick(() => this.props.onCopy?.());
            });
        }

        if (this.props.onMove) {
            menu.addItem((item) => {
                item.setTitle("Move")
                    .setIcon("folder-input")
                    .onClick(() => this.props.onMove?.());
            });
        }

        if (this.props.onDelete) {
            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle("Delete")
                    .setIcon("trash-2")
                    .onClick(() => this.props.onDelete?.());
            });
        }

        if (this.props.onSelect && !this.props.isSelectionMode) {
            menu.addSeparator();
            menu.addItem((item) => {
                item.setTitle("Select")
                    .setIcon("check-square")
                    .onClick(() => this.props.onSelect?.());
            });
        }

        menu.showAtMouseEvent(e);
    }

    private getStatusDotColor(): string {
        if (!this.props.fsrsCard) return "ep:bg-gray-400";

        switch (this.props.fsrsCard.fsrs.state) {
            case State.New:
                return "ep:bg-blue-500";
            case State.Learning:
            case State.Relearning:
                return "ep:bg-orange-500";
            case State.Review:
                return "ep:bg-green-500";
            default:
                return "ep:bg-gray-400";
        }
    }

    private getStatusTitle(): string {
        if (!this.props.fsrsCard) return "Unknown";

        switch (this.props.fsrsCard.fsrs.state) {
            case State.New:
                return "New";
            case State.Learning:
                return "Learning";
            case State.Relearning:
                return "Relearning";
            case State.Review:
                return "Review";
            default:
                return "Unknown";
        }
    }

    private truncateText(text: string, maxLength: number): string {
        // Remove newlines and excess whitespace
        const cleaned = text.replace(/\s+/g, " ").trim();
        if (cleaned.length <= maxLength) return cleaned;
        return cleaned.substring(0, maxLength) + "...";
    }

    updateProps(props: Partial<CompactCardItemProps>): void {
        this.props = { ...this.props, ...props };
        this.render();
    }

    destroy(): void {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
        }
        super.destroy();
    }
}

export function createCompactCardItem(
    container: HTMLElement,
    props: CompactCardItemProps
): CompactCardItem {
    const item = new CompactCardItem(container, props);
    item.render();
    return item;
}
