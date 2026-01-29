/**
 * Flashcard Panel Footer Component
 * Displays action buttons and instructions input
 */
import type { TFile } from "obsidian";
import { BaseComponent } from "../component.base";
import { createActionButton, type ActionButton } from "../components";
import type { ProcessingStatus } from "../../state";
import type { NoteFlashcardType } from "../../types";

export interface FlashcardPanelFooterProps {
	currentFile: TFile | null;
	status: ProcessingStatus;
	isFlashcardFile: boolean;
	/** Note type for determining button label (Seed vs Generate) */
	noteFlashcardType?: NoteFlashcardType;
	// Selection info for bulk move button
	selectedCount?: number;
	// Collect flashcards from markdown
	hasUncollectedFlashcards?: boolean;
	uncollectedCount?: number;
	onGenerate?: () => void;
	onMoveSelected?: () => void;
	onDeleteSelected?: () => void;
	onAddFlashcard?: () => void;
	onCollect?: () => void;
}

/**
 * Flashcard panel footer component
 */
export class FlashcardPanelFooter extends BaseComponent {
	private props: FlashcardPanelFooterProps;

	constructor(container: HTMLElement, props: FlashcardPanelFooterProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		// Clear existing element if any
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { currentFile } = this.props;

		// Don't render if no file or not markdown
		if (!currentFile || currentFile.extension !== "md") {
			return;
		}

		this.element = this.container.createDiv({
			cls: "ep:border-t ep:border-obs-border ep:pt-2 ep:mt-auto ep:flex ep:flex-col ep:gap-2",
		});

		this.renderNormalFooter();
	}

	private renderNormalFooter(): void {
		const {
			status,
			isFlashcardFile,
			selectedCount,
			hasUncollectedFlashcards,
			uncollectedCount,
			onGenerate,
			onMoveSelected,
			onDeleteSelected,
			onAddFlashcard,
			onCollect,
		} = this.props;

		if (!this.element) return;

		// Create footer buttons wrapper (horizontal row layout)
		const buttonsWrapper = this.element.createDiv({
			cls: "ep:flex ep:gap-2",
		});

		// Show selection action buttons when cards are selected
		if (selectedCount && selectedCount > 0) {
			if (onMoveSelected) {
				createActionButton(buttonsWrapper, {
					label: `Move (${selectedCount})`,
					variant: "seed",
					fullWidth: true,
					onClick: onMoveSelected,
				});
			}

			if (onDeleteSelected) {
				createActionButton(buttonsWrapper, {
					label: `Delete (${selectedCount})`,
					variant: "danger",
					fullWidth: true,
					onClick: onDeleteSelected,
				});
			}
			return;
		}

		// Don't show other buttons for flashcard files
		if (isFlashcardFile) {
			return;
		}

		// ===== COLLECT BUTTON (when uncollected flashcards exist) =====
		// Custom styling with gradient - not using ActionButton
		if (hasUncollectedFlashcards && onCollect) {
			const collectBtn = buttonsWrapper.createEl("button", {
				cls: "ep:flex-1 ep:border-none ep:py-2.5 ep:px-4 ep:rounded-md ep:cursor-pointer ep:font-semibold ep:text-ui-small ep:transition-colors ep:text-gray-800",
			});
			collectBtn.style.background = "linear-gradient(135deg, #fbbf24, #f59e0b)";
			collectBtn.textContent = `Collect (${uncollectedCount})`;
			this.events.addEventListener(collectBtn, "click", onCollect);
		}

		// Main action button (Generate only when no flashcards exist)
		if (status !== "exists") {
			const isProcessing = status === "processing";
			createActionButton(buttonsWrapper, {
				label: isProcessing ? "Processing..." : "Generate",
				variant: "primary",
				fullWidth: true,
				disabled: isProcessing,
				onClick: isProcessing ? undefined : onGenerate,
			});
		}

		// Add flashcard button - second in row
		if (onAddFlashcard) {
			createActionButton(buttonsWrapper, {
				label: "+ Add",
				variant: "secondary",
				fullWidth: true,
				onClick: onAddFlashcard,
			});
		}
	}

	/**
	 * Update the footer with new props
	 */
	updateProps(props: Partial<FlashcardPanelFooterProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

/**
 * Create a flashcard panel footer component
 */
export function createFlashcardPanelFooter(
	container: HTMLElement,
	props: FlashcardPanelFooterProps
): FlashcardPanelFooter {
	const footer = new FlashcardPanelFooter(container, props);
	footer.render();
	return footer;
}
