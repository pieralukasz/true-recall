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

        const { currentFile, status, onOpenFlashcardFile, onReviewFlashcards } = this.props;

        this.element = this.container.createDiv({
            cls: "episteme-header",
        });

        const titleRow = this.element.createDiv({
            cls: "episteme-title-row",
        });

        // Status indicator
        const statusEl = titleRow.createSpan({ cls: "episteme-status" });
        statusEl.textContent = getStatusIcon(status);

        // Note title
        const titleEl = titleRow.createSpan({ cls: "episteme-title" });
        if (currentFile) {
            titleEl.textContent = this.props.displayTitle ?? currentFile.basename;
        } else {
            titleEl.textContent = "No note selected";
        }

        // Action buttons (only when flashcards exist)
        if (status === "exists" && currentFile) {
            // Review flashcards button
            if (onReviewFlashcards) {
                const reviewBtn = titleRow.createEl("button", {
                    cls: "episteme-review-btn clickable-icon",
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
                    cls: "episteme-open-btn clickable-icon",
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
