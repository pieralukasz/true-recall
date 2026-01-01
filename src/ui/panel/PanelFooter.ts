/**
 * Panel Footer Component
 * Displays action buttons and instructions input
 */
import type { TFile } from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProcessingStatus, ViewMode } from "../../state";
import type { DiffResult } from "../../types";

export interface PanelFooterProps {
    currentFile: TFile | null;
    status: ProcessingStatus;
    viewMode: ViewMode;
    diffResult: DiffResult | null;
    isFlashcardFile: boolean;
    onGenerate?: () => void;
    onUpdate?: () => void;
    onApplyDiff?: () => void;
    onCancelDiff?: () => void;
}

/**
 * Panel footer component
 */
export class PanelFooter extends BaseComponent {
    private props: PanelFooterProps;
    private instructionsInput: HTMLTextAreaElement | null = null;

    constructor(container: HTMLElement, props: PanelFooterProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        // Clear existing element if any
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        const { currentFile, viewMode, diffResult } = this.props;

        // Don't render if no file or not markdown
        if (!currentFile || currentFile.extension !== "md") {
            return;
        }

        this.element = this.container.createDiv({
            cls: "shadow-anki-footer",
        });

        // Diff mode footer
        if (viewMode === "diff" && diffResult) {
            this.renderDiffFooter();
        } else {
            this.renderNormalFooter();
        }
    }

    private renderDiffFooter(): void {
        const { diffResult, onUpdate, onApplyDiff, onCancelDiff } = this.props;

        if (!this.element || !diffResult) return;

        const acceptedCount = diffResult.changes.filter((c) => c.accepted).length;

        // Instructions input for regenerate
        this.renderInstructionsInput(
            "Additional instructions (e.g., 'make shorter', 'focus on X')..."
        );

        // Buttons row
        const buttonsRow = this.element.createDiv({
            cls: "shadow-anki-buttons-row",
        });

        // Regenerate button
        const regenerateBtn = buttonsRow.createEl("button", {
            text: "Regenerate",
            cls: "shadow-anki-btn-secondary",
        });
        if (onUpdate) {
            this.events.addEventListener(regenerateBtn, "click", onUpdate);
        }

        // Apply button
        const applyBtn = buttonsRow.createEl("button", {
            cls: "shadow-anki-btn-primary",
        });
        applyBtn.textContent = `Apply (${acceptedCount})`;
        applyBtn.disabled = acceptedCount === 0;
        if (onApplyDiff) {
            this.events.addEventListener(applyBtn, "click", onApplyDiff);
        }

        // Cancel button
        const cancelBtn = buttonsRow.createEl("button", {
            text: "Cancel",
            cls: "shadow-anki-btn-secondary",
        });
        if (onCancelDiff) {
            this.events.addEventListener(cancelBtn, "click", onCancelDiff);
        }
    }

    private renderNormalFooter(): void {
        const { status, isFlashcardFile, onGenerate, onUpdate } = this.props;

        if (!this.element) return;

        // Don't show Generate/Update buttons for flashcard files
        if (isFlashcardFile) {
            return;
        }

        // Instructions input
        this.renderInstructionsInput(
            "Instructions for AI (optional)...",
            status === "processing"
        );

        // Main action button
        const mainBtn = this.element.createEl("button", {
            cls: "shadow-anki-btn-primary",
        });

        if (status === "processing") {
            mainBtn.textContent = "Processing...";
            mainBtn.disabled = true;
        } else if (status === "exists") {
            mainBtn.textContent = "Update flashcards";
            if (onUpdate) {
                this.events.addEventListener(mainBtn, "click", onUpdate);
            }
        } else {
            mainBtn.textContent = "Generate flashcards";
            if (onGenerate) {
                this.events.addEventListener(mainBtn, "click", onGenerate);
            }
        }
    }

    private renderInstructionsInput(
        placeholder: string,
        disabled: boolean = false
    ): void {
        if (!this.element) return;

        const instructionsContainer = this.element.createDiv({
            cls: "shadow-anki-instructions-container",
        });

        this.instructionsInput = instructionsContainer.createEl("textarea", {
            cls: "shadow-anki-instructions-input",
            placeholder,
        });
        this.instructionsInput.disabled = disabled;
    }

    /**
     * Update the footer with new props
     */
    updateProps(props: Partial<PanelFooterProps>): void {
        this.props = { ...this.props, ...props };
        this.render();
    }

    /**
     * Get current instructions value
     */
    getInstructions(): string {
        return this.instructionsInput?.value ?? "";
    }
}

/**
 * Create a panel footer component
 */
export function createPanelFooter(
    container: HTMLElement,
    props: PanelFooterProps
): PanelFooter {
    const footer = new PanelFooter(container, props);
    footer.render();
    return footer;
}
