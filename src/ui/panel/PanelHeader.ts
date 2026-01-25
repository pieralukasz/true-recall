/**
 * Panel Header Component
 * Displays the title and status of the flashcard panel
 */
import type { TFile } from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProcessingStatus } from "../../state";

export interface PanelHeaderProps {
    currentFile: TFile | null;
    status: ProcessingStatus;
    displayTitle?: string;
    onOpenFlashcardFile?: () => void;
    onReviewFlashcards?: () => void;
    onDeleteAllFlashcards?: () => void;
}

/**
 * Get status icon based on processing status
 */
function getStatusIcon(status: ProcessingStatus): string {
    switch (status) {
        case "exists":
            return "\u{1F7E2}"; // green circle
        case "processing":
            return "\u{1F7E1}"; // yellow circle
        default:
            return "\u{1F534}"; // red circle
    }
}

/**
 * Panel header component
 */
export class PanelHeader extends BaseComponent {
    private props: PanelHeaderProps;

    constructor(container: HTMLElement, props: PanelHeaderProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        // Clear existing element if any
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        const { currentFile, status, onOpenFlashcardFile, onReviewFlashcards, onDeleteAllFlashcards } = this.props;

        this.element = this.container.createDiv({
            cls: "ep:pb-2 ep:mb-2",
        });

        const titleRow = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2",
        });

        // Status indicator
        const statusEl = titleRow.createSpan({ cls: "ep:text-xs ep:shrink-0" });
        statusEl.textContent = getStatusIcon(status);

        // Note title
        const titleEl = titleRow.createSpan({
            cls: "ep:font-semibold ep:text-sm ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:text-obs-normal",
        });
        if (currentFile) {
            titleEl.textContent = this.props.displayTitle ?? currentFile.basename;
        } else {
            titleEl.textContent = "No note selected";
        }

        // Shared button styles
        const btnClasses = "ep:cursor-pointer ep:opacity-70 ep:text-sm ep:px-1 ep:py-0.5 ep:rounded ep:shrink-0 ep:hover:opacity-100 ep:hover:bg-obs-modifier-hover clickable-icon";

        // Action buttons (only when flashcards exist)
        if (status === "exists" && currentFile) {
            // Review flashcards button
            if (onReviewFlashcards) {
                const reviewBtn = titleRow.createEl("button", {
                    cls: btnClasses,
                    attr: {
                        "aria-label": "Review flashcards from this note",
                        "data-tooltip-position": "top",
                    },
                });
                reviewBtn.textContent = "\u{1F9E0}"; // brain emoji
                this.events.addEventListener(reviewBtn, "click", () => {
                    onReviewFlashcards();
                });
                this.events.addEventListener(reviewBtn, "keydown", (e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onReviewFlashcards();
                    }
                });
            }

            // Open flashcard file button
            if (onOpenFlashcardFile) {
                const openBtn = titleRow.createEl("button", {
                    cls: btnClasses,
                    attr: {
                        "aria-label": "Open flashcard file",
                        "data-tooltip-position": "top",
                    },
                });
                openBtn.textContent = "\u{1F4C4}"; // document emoji
                this.events.addEventListener(openBtn, "click", () => {
                    onOpenFlashcardFile();
                });
                this.events.addEventListener(openBtn, "keydown", (e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenFlashcardFile();
                    }
                });
            }

            // Delete all flashcards button
            if (onDeleteAllFlashcards) {
                const deleteAllBtn = titleRow.createEl("button", {
                    cls: btnClasses,
                    attr: {
                        "aria-label": "Delete all flashcards for this note",
                        "data-tooltip-position": "top",
                    },
                });
                deleteAllBtn.textContent = "\u{1F5D1}"; // wastebasket emoji
                this.events.addEventListener(deleteAllBtn, "click", () => {
                    onDeleteAllFlashcards();
                });
                this.events.addEventListener(deleteAllBtn, "keydown", (e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onDeleteAllFlashcards();
                    }
                });
            }
        }
    }

    /**
     * Update the header with new props
     */
    updateProps(props: Partial<PanelHeaderProps>): void {
        this.props = { ...this.props, ...props };
        this.render();
    }
}

/**
 * Create a panel header component
 */
export function createPanelHeader(
    container: HTMLElement,
    props: PanelHeaderProps
): PanelHeader {
    const header = new PanelHeader(container, props);
    header.render();
    return header;
}
