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
    onOpenFlashcardFile?: () => void;
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

        const { currentFile, status, onOpenFlashcardFile } = this.props;

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
            titleEl.textContent = currentFile.basename;
        } else {
            titleEl.textContent = "No note selected";
        }

        // Open flashcard file icon button (only when flashcards exist)
        if (status === "exists" && currentFile && onOpenFlashcardFile) {
            const openBtn = titleRow.createSpan({
                cls: "episteme-open-btn clickable-icon",
            });
            openBtn.textContent = "\u{1F4C4}"; // document emoji
            openBtn.setAttribute("aria-label", "Open flashcard file");
            this.events.addEventListener(openBtn, "click", () => {
                onOpenFlashcardFile();
            });
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
