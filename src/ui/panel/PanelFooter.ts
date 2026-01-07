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

        const { hasSelection } = this.props;

        // If text is selected, always use normal footer (shows selection UI)
        // Diff mode only available when no selection and in diff state
        if (viewMode === "diff" && diffResult && !hasSelection) {
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

        // ===== SELECTION-BASED UI (ANY NOTE TYPE WITH SELECTION) =====
        const { hasSelection, selectedText } = this.props;
        if (hasSelection && selectedText) {
            this.renderSelectionFooter(buttonsWrapper);
            return;
        }

        // ===== NO SELECTION UI =====
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

        // Hint about selection-based generation (only when no flashcards yet)
        if (status !== "exists" && status !== "processing") {
            const hintEl = buttonsWrapper.createDiv({
                cls: "episteme-selection-hint",
            });
            hintEl.innerHTML = `<span style="font-size: 11px; color: var(--text-muted);">💡 Or select specific text to generate from selection</span>`;
        }
    }

    /**
     * Render footer for selection-based generation (any note type with text selected)
     */
    private renderSelectionFooter(container: HTMLElement): void {
        const { selectedText, onGenerate } = this.props;

        // Show selection preview and generate button
        const selectionPreview = container.createDiv({
            cls: "episteme-selection-preview",
        });

        selectionPreview.createSpan({
            cls: "episteme-selection-preview-label",
            text: "Selected:",
        });

        const previewText = selectionPreview.createSpan({
            cls: "episteme-selection-preview-text",
            text: this.truncateText(selectedText || "", 100),
        });
        previewText.setAttribute("title", selectedText || ""); // Show full text on hover

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
