/**
 * Panel Footer Component
 * Displays action buttons and instructions input
 */
import type { TFile } from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProcessingStatus, ViewMode } from "../../state";
import type { DiffResult, NoteFlashcardType } from "../../types";

export interface PanelFooterProps {
    currentFile: TFile | null;
    status: ProcessingStatus;
    viewMode: ViewMode;
    diffResult: DiffResult | null;
    isFlashcardFile: boolean;
    /** Note type for determining button label (Seed vs Generate) */
    noteFlashcardType?: NoteFlashcardType;
    // Selection info for bulk move button
    selectedCount?: number;
    // Selection state for literature notes
    hasSelection?: boolean;
    selectedText?: string;
    onGenerate?: () => void;
    onUpdate?: () => void;
    onApplyDiff?: () => void;
    onCancelDiff?: () => void;
    onMoveSelected?: () => void;
    onDeleteSelected?: () => void;
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

        const { currentFile, viewMode, diffResult, noteFlashcardType } = this.props;

        // Don't render if no file or not markdown
        if (!currentFile || currentFile.extension !== "md") {
            return;
        }

        this.element = this.container.createDiv({
            cls: "episteme-footer",
        });

        // Literature notes never use diff mode - always use normal footer
        if (noteFlashcardType === "temporary") {
            this.renderNormalFooter();
            return;
        }

        // Diff mode footer (for other note types)
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

        // Buttons row wrapper
        const buttonsRow = this.element.createDiv({
            cls: "episteme-footer-buttons episteme-buttons-row",
        });

        // Regenerate button
        const regenerateBtn = buttonsRow.createEl("button", {
            text: "Regenerate",
            cls: "episteme-btn-secondary",
        });
        if (onUpdate) {
            this.events.addEventListener(regenerateBtn, "click", onUpdate);
        }

        // Apply button
        const applyBtn = buttonsRow.createEl("button", {
            cls: "episteme-btn-primary",
        });
        applyBtn.textContent = `Apply (${acceptedCount})`;
        applyBtn.disabled = acceptedCount === 0;
        if (onApplyDiff) {
            this.events.addEventListener(applyBtn, "click", onApplyDiff);
        }

        // Cancel button
        const cancelBtn = buttonsRow.createEl("button", {
            text: "Cancel",
            cls: "episteme-btn-secondary",
        });
        if (onCancelDiff) {
            this.events.addEventListener(cancelBtn, "click", onCancelDiff);
        }
    }

    private renderNormalFooter(): void {
        const { status, isFlashcardFile, selectedCount, noteFlashcardType, onGenerate, onUpdate, onMoveSelected, onDeleteSelected } = this.props;

        if (!this.element) return;

        // Create footer buttons wrapper
        const buttonsWrapper = this.element.createDiv({
            cls: "episteme-footer-buttons",
        });

        // Show "Move selected" button whenever cards are selected (for temporary cards)
        if (selectedCount && selectedCount > 0 && onMoveSelected) {
            const moveBtn = buttonsWrapper.createEl("button", {
                cls: "episteme-btn-seed episteme-move-selected-btn",
            });
            moveBtn.textContent = `Move selected (${selectedCount})`;
            this.events.addEventListener(moveBtn, "click", onMoveSelected);
        }

        // Show "Delete selected" button whenever cards are selected
        if (selectedCount && selectedCount > 0 && onDeleteSelected) {
            const deleteBtn = buttonsWrapper.createEl("button", {
                cls: "episteme-btn-danger episteme-delete-selected-btn",
            });
            deleteBtn.textContent = `Delete selected (${selectedCount})`;
            this.events.addEventListener(deleteBtn, "click", onDeleteSelected);
        }

        // Don't show other buttons for flashcard files
        if (isFlashcardFile) {
            return;
        }

        // ===== DIFFERENT UI FOR LITERATURE NOTES =====
        if (noteFlashcardType === "temporary") {
            this.renderLiteratureNoteFooter(buttonsWrapper);
            return;
        }

        // ===== EXISTING UI FOR OTHER NOTE TYPES =====
        // Instructions input
        this.renderInstructionsInput(
            "Instructions for AI (optional)...",
            status === "processing"
        );

        // Main action button
        const mainBtn = buttonsWrapper.createEl("button", {
            cls: "episteme-btn-primary",
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

    /**
     * Render footer for literature notes (selection-based generation)
     */
    private renderLiteratureNoteFooter(container: HTMLElement): void {
        const { hasSelection, selectedText, onGenerate } = this.props;

        if (!hasSelection || !selectedText) {
            // Show message when no text is selected
            const messageEl = container.createDiv({
                cls: "episteme-selection-message",
            });
            messageEl.textContent = "Select text in the note to generate flashcards";
            messageEl.addClass("episteme-selection-message--empty");

            // Add icon
            const iconEl = messageEl.createSpan({
                cls: "episteme-selection-icon",
            });
            iconEl.textContent = "📝";
            return;
        }

        // Show selection preview and generate button when text is selected
        const selectionPreview = container.createDiv({
            cls: "episteme-selection-preview",
        });

        const previewLabel = selectionPreview.createSpan({
            cls: "episteme-selection-preview-label",
            text: "Selected:",
        });

        const previewText = selectionPreview.createSpan({
            cls: "episteme-selection-preview-text",
            text: this.truncateText(selectedText, 100),
        });
        previewText.setAttribute("title", selectedText); // Show full text on hover

        // Instructions input (optional)
        this.renderInstructionsInput("Additional instructions (optional)...", false);

        // Generate button
        const generateBtn = container.createEl("button", {
            text: "Generate flashcards from selection",
            cls: "episteme-btn-primary episteme-btn-generate-selection",
        });

        if (onGenerate) {
            this.events.addEventListener(generateBtn, "click", onGenerate);
        }
    }

    /**
     * Truncate text for preview
     */
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    }

    private renderInstructionsInput(
        placeholder: string,
        disabled: boolean = false
    ): void {
        if (!this.element) return;

        const instructionsContainer = this.element.createDiv({
            cls: "episteme-instructions-container",
        });

        this.instructionsInput = instructionsContainer.createEl("textarea", {
            cls: "episteme-instructions-input",
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
