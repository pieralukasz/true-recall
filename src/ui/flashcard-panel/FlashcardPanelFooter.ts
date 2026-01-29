/**
 * Flashcard Panel Footer Component
 * Displays action buttons and instructions input
 */
import type { TFile } from "obsidian";
import { BaseComponent } from "../component.base";
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

		// Shared button base classes
		const btnBase = "ep:flex-1 ep:border-none ep:py-2.5 ep:px-4 ep:rounded-md ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-colors";
		const btnPrimary = `${btnBase} mod-cta`;
		const btnSecondary = `${btnBase} ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`;
		const btnDanger = `${btnBase} ep:bg-red-500 ep:text-white ep:hover:bg-red-600`;
		const btnSeed = `${btnBase} ep:bg-obs-border ep:text-obs-normal ep:font-semibold ep:hover:bg-amber-400 ep:hover:text-white`;

		// Create footer buttons wrapper (horizontal row layout)
		const buttonsWrapper = this.element.createDiv({
			cls: "ep:flex ep:gap-2",
		});

		// Show selection action buttons when cards are selected
		if (selectedCount && selectedCount > 0) {
			if (onMoveSelected) {
				const moveBtn = buttonsWrapper.createEl("button", {
					cls: btnSeed,
				});
				moveBtn.textContent = `Move (${selectedCount})`;
				this.events.addEventListener(moveBtn, "click", onMoveSelected);
			}

			if (onDeleteSelected) {
				const deleteBtn = buttonsWrapper.createEl("button", {
					cls: btnDanger,
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

		// ===== COLLECT BUTTON (when uncollected flashcards exist) =====
		if (hasUncollectedFlashcards && onCollect) {
			const collectBtn = buttonsWrapper.createEl("button", {
				cls: `${btnBase} ep:text-gray-800 ep:font-semibold`,
			});
			collectBtn.style.background = "linear-gradient(135deg, #fbbf24, #f59e0b)";
			collectBtn.textContent = `Collect (${uncollectedCount})`;
			this.events.addEventListener(collectBtn, "click", onCollect);
		}

		// Main action button (Generate only when no flashcards exist)
		if (status !== "exists") {
			const mainBtn = buttonsWrapper.createEl("button", {
				cls: btnPrimary,
			});

			if (status === "processing") {
				mainBtn.textContent = "Processing...";
				mainBtn.disabled = true;
				mainBtn.classList.add("ep:opacity-60", "ep:cursor-not-allowed");
			} else {
				mainBtn.textContent = "Generate";
				if (onGenerate) {
					this.events.addEventListener(mainBtn, "click", onGenerate);
				}
			}
		}

		// Add flashcard button - second in row
		if (onAddFlashcard) {
			const addBtn = buttonsWrapper.createEl("button", {
				text: "+ Add",
				cls: btnSecondary,
			});
			this.events.addEventListener(addBtn, "click", onAddFlashcard);
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
