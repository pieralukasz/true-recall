/**
 * Compact Card Item Component
 * Single-line card with status dot, question, and dropdown menu
 * Expands to show answer on click
 */
import { App, Component, Menu, MarkdownRenderer, setIcon } from "obsidian";
import { State } from "ts-fsrs";
import { BaseComponent } from "../component.base";
import { setupLongPress, type LongPressResult } from "../utils";
import type { FlashcardItem } from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { stripBrTags } from "../../utils";

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

/**
 * Compact card item with expandable answer
 */
export class CompactCardItem extends BaseComponent {
    private props: CompactCardItemProps;
    private longPressHandler: LongPressResult | null = null;
    private answerContainer: HTMLElement | null = null;

    constructor(container: HTMLElement, props: CompactCardItemProps) {
        super(container);
        this.props = props;
    }

    getCardId(): string {
        return this.props.card.id;
    }

    render(): void {
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        const { card, isExpanded, isSelected, isSelectionMode, app, filePath, component } = this.props;

        this.element = this.container.createDiv({
            cls: `ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border ep:shadow-sm ${isSelected ? "ep:border-obs-interactive ep:border-2" : ""}`,
        });

        // Main row (always visible)
        const mainRow = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:p-3 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded-md ep:transition-colors",
        });

        // Setup long press for main row
        this.longPressHandler = setupLongPress(mainRow, this.events, {
            onLongPress: () => this.props.onLongPress?.(),
        });

        // Click handler for expand/collapse or select
        this.events.addEventListener(mainRow, "click", (e) => {
            if (this.longPressHandler?.didLongPress()) {
                return;
            }
            // Don't trigger if clicked on menu button or internal link
            if ((e.target as HTMLElement).closest("button")) return;
            if ((e.target as HTMLElement).closest("a")) return;

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
        const dot = mainRow.createDiv({
            cls: "ep:w-2.5 ep:h-2.5 ep:rounded-full ep:flex-shrink-0",
            attr: { title: this.getStatusTitle() },
        });
        dot.addClass("ep-dynamic-bg");
        dot.style.setProperty("--ep-dynamic-color", this.getStatusDotColor());

        // Buried/Suspended indicator
        if (this.isSuspended()) {
            mainRow.createSpan({
                cls: "ep:text-ui-smaller ep:text-obs-red ep:font-medium ep:flex-shrink-0",
                text: "S",
                attr: { title: "Suspended - excluded from review" },
            });
        } else if (this.isBuried()) {
            const buriedDate = new Date(this.props.fsrsCard!.fsrs.buriedUntil!);
            mainRow.createSpan({
                cls: "ep:text-ui-smaller ep:text-obs-faint ep:font-medium ep:flex-shrink-0",
                text: "B",
                attr: { title: `Buried until ${buriedDate.toLocaleDateString()}` },
            });
        }

        // Question (rendered markdown, full content with line breaks)
        const questionEl = mainRow.createDiv({
            cls: "ep:flex-1 ep:text-ui-small ep:text-obs-normal true-recall-card-markdown",
        });
        void MarkdownRenderer.render(app, stripBrTags(card.question), questionEl, filePath, component);
        this.setupCmdClickLinks(questionEl);

        // Menu icon
        const menuBtn = mainRow.createEl("button", {
            cls: "clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
            attr: { "aria-label": "Card actions" },
        });
        setIcon(menuBtn, "more-vertical");
        this.events.addEventListener(menuBtn, "click", (e) => {
            e.stopPropagation();
            this.showCardMenu(e);
        });

        // Expanded content (answer)
        if (isExpanded) {
            this.renderExpandedContent();
        }
    }

    updateExpandSelectState(state: {
        isExpanded: boolean;
        isSelected: boolean;
    }): void {
        if (!this.element) return;

        // Update selected border
        if (state.isSelected !== this.props.isSelected) {
            if (state.isSelected) {
                this.element.addClass("ep:border-obs-interactive", "ep:border-2");
            } else {
                this.element.removeClass("ep:border-obs-interactive", "ep:border-2");
            }
            this.props.isSelected = state.isSelected;
        }

        // Update expanded content
        if (state.isExpanded !== this.props.isExpanded) {
            if (state.isExpanded) {
                this.renderExpandedContent();
            } else if (this.answerContainer) {
                this.answerContainer.remove();
                this.answerContainer = null;
            }
            this.props.isExpanded = state.isExpanded;
        }
    }

    private renderExpandedContent(): void {
        if (!this.element) return;

        const { card, filePath, app, component } = this.props;

        this.answerContainer = this.element.createDiv({
            cls: "ep:px-3 ep:pb-3 ep:pt-3 ep:border-t ep:border-obs-border",
        });

        const answerContent = this.answerContainer.createDiv({
            cls: "ep:text-ui-small ep:text-obs-normal true-recall-panel-card-field",
        });

        void MarkdownRenderer.render(app, stripBrTags(card.answer), answerContent, filePath, component);
        this.setupCmdClickLinks(answerContent);
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
        if (!this.props.fsrsCard) return "var(--text-muted)";

        switch (this.props.fsrsCard.fsrs.state) {
            case State.New:
                return "var(--color-green)";
            case State.Learning:
            case State.Relearning:
                return "var(--color-orange)";
            case State.Review:
                return "var(--color-blue)";
            default:
                return "var(--text-muted)";
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

    private isSuspended(): boolean {
        return this.props.fsrsCard?.fsrs.suspended === true;
    }

    private isBuried(): boolean {
        const buriedUntil = this.props.fsrsCard?.fsrs.buriedUntil;
        if (!buriedUntil) return false;
        return new Date(buriedUntil) > new Date();
    }

    private setupCmdClickLinks(container: HTMLElement): void {
        const { app, filePath } = this.props;
        this.events.addEventListener(container, "click", (e) => {
            const target = e.target as HTMLElement;
            const linkEl = target.closest("a.internal-link");
            if (!linkEl) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (e.metaKey || e.ctrlKey) {
                const href = linkEl.getAttribute("data-href");
                if (href) {
                    void app.workspace.openLinkText(href, filePath, false);
                }
            }
        }, true);
    }

    updateProps(props: Partial<CompactCardItemProps>): void {
        this.props = { ...this.props, ...props };
        this.render();
    }

    destroy(): void {
        this.longPressHandler = null;
        this.answerContainer = null;
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
