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
	onAddFlashcard?: () => void;
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

		const { currentFile, viewMode, diffResult, noteFlashcardType } =
			this.props;

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

		const acceptedCount = diffResult.changes.filter(
			(c) => c.accepted
		).length;

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
		const {
			status,
			isFlashcardFile,
			selectedCount,
			onGenerate,
			onUpdate,
			onMoveSelected,
			onDeleteSelected,
			onAddFlashcard,
		} = this.props;

		if (!this.element) return;

		// Create footer buttons wrapper (horizontal row layout)
		const buttonsWrapper = this.element.createDiv({
			cls: "episteme-footer-buttons episteme-buttons-row",
		});

		// Show selection action buttons when cards are selected
		if (selectedCount && selectedCount > 0) {
			if (onMoveSelected) {
				const moveBtn = buttonsWrapper.createEl("button", {
					cls: "episteme-btn-seed",
				});
				moveBtn.textContent = `Move (${selectedCount})`;
				this.events.addEventListener(moveBtn, "click", onMoveSelected);
			}

			if (onDeleteSelected) {
				const deleteBtn = buttonsWrapper.createEl("button", {
					cls: "episteme-btn-danger",
				});
				deleteBtn.textContent = `Delete (${selectedCount})`;
				this.events.addEventListener(deleteBtn, "click", onDeleteSelected);
			}
			return;
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
		// Main action button (Generate/Update) - first in row
		const mainBtn = buttonsWrapper.createEl("button", {
			cls: "episteme-btn-primary",
		});

		if (status === "processing") {
			mainBtn.textContent = "Processing...";
			mainBtn.disabled = true;
		} else if (status === "exists") {
			mainBtn.textContent = "Update";
			if (onUpdate) {
				this.events.addEventListener(mainBtn, "click", onUpdate);
			}
		} else {
			mainBtn.textContent = "Generate";
			if (onGenerate) {
				this.events.addEventListener(mainBtn, "click", onGenerate);
			}
		}

		// Add flashcard button - second in row
		if (onAddFlashcard) {
			const addBtn = buttonsWrapper.createEl("button", {
				text: "+ Add",
				cls: "episteme-btn-secondary",
			});
			this.events.addEventListener(addBtn, "click", onAddFlashcard);
		}
	}

	/**
	 * Render footer for selection-based generation (any note type with text selected)
	 */
	private renderSelectionFooter(container: HTMLElement): void {
		const { selectedText, onGenerate } = this.props;

		if (!this.element) return;

		// Show selection preview above buttons
		const selectionPreview = this.element.createDiv({
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

		// Generate button (full width in selection mode)
		const generateBtn = container.createEl("button", {
			text: "Generate from selection",
			cls: "episteme-btn-primary",
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
