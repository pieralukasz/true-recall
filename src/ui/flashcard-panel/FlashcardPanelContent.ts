/**
 * Flashcard Panel Content Component
 * Displays the main content area of the flashcard panel
 */
import {
	setIcon,
	type App,
	type Component,
	type TFile,
	type MarkdownRenderer,
} from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProcessingStatus, ViewMode, SelectionMode } from "../../state";
import type {
	FlashcardInfo,
	FlashcardItem,
	FlashcardChange,
	DiffResult,
	NoteFlashcardType,
} from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { createLoadingSpinner } from "../components/LoadingSpinner";
import { createEmptyState, EmptyStateMessages } from "../components/EmptyState";
import { createCompactCardItem } from "./CompactCardItem";
import { createDiffCard } from "../components/DiffCard";

export interface FlashcardPanelContentHandlers {
	app: App;
	component: Component;
	markdownRenderer: typeof MarkdownRenderer;
	onEditCard?: (card: FlashcardItem) => void;
	onEditButton?: (card: FlashcardItem) => void;
	onCopyCard?: (card: FlashcardItem) => void;
	onDeleteCard?: (card: FlashcardItem) => void;
	onMoveCard?: (card: FlashcardItem) => void;
	onChangeAccept?: (
		change: FlashcardChange,
		index: number,
		accepted: boolean
	) => void;
	onSelectAll?: (selected: boolean) => void;
	// In-place edit save handler
	onEditSave?: (
		card: FlashcardItem,
		field: "question" | "answer",
		newContent: string
	) => Promise<void>;
	// Diff edit change handler
	onEditChange?: (
		change: FlashcardChange,
		field: "question" | "answer",
		newContent: string
	) => void;
	// Handlers for compact design
	onToggleExpand?: (cardId: string) => void;
	onToggleSelect?: (cardId: string) => void;
	onEnterSelectionMode?: (cardId: string) => void;
	// Add flashcard handler
	onAdd?: () => void;
}

export interface FlashcardPanelContentProps {
	currentFile: TFile | null;
	status: ProcessingStatus;
	viewMode: ViewMode;
	flashcardInfo: FlashcardInfo | null;
	diffResult: DiffResult | null;
	isFlashcardFile: boolean;
	// Note flashcard type based on tags
	noteFlashcardType?: NoteFlashcardType;
	handlers: FlashcardPanelContentHandlers;
	// Props for compact design
	selectionMode: SelectionMode;
	selectedCardIds: Set<string>;
	expandedCardIds: Set<string>;
	cardsWithFsrs?: FSRSFlashcardItem[];
}

/**
 * Flashcard panel content component
 */
export class FlashcardPanelContent extends BaseComponent {
	private props: FlashcardPanelContentProps;
	private childComponents: BaseComponent[] = [];

	constructor(container: HTMLElement, props: FlashcardPanelContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		// Cleanup child components
		this.cleanupChildren();

		// Clear existing element if any
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "ep:flex ep:flex-col ep:flex-1 ep:overflow-y-auto",
		});

		const { status, viewMode, diffResult, currentFile } = this.props;

		// Show loader if processing
		if (status === "processing") {
			this.renderProcessingState();
			return;
		}

		// Show diff view if in diff mode
		if (viewMode === "diff" && diffResult) {
			this.renderDiffState();
			return;
		}

		// No file selected
		if (!currentFile) {
			this.renderEmptyState(EmptyStateMessages.NO_FILE);
			return;
		}

		// Not markdown file
		if (currentFile.extension !== "md") {
			this.renderEmptyState(EmptyStateMessages.NOT_MARKDOWN);
			return;
		}

		// Render based on flashcard existence
		const { flashcardInfo } = this.props;
		if (!flashcardInfo?.exists) {
			this.renderNoFlashcardsState();
		} else {
			this.renderPreviewState();
		}
	}

	private renderProcessingState(): void {
		if (!this.element) return;

		const spinner = createLoadingSpinner(this.element, {
			message: "Generating flashcards...",
			subMessage: "AI is analyzing your note",
		});
		this.childComponents.push(spinner);
	}

	private renderEmptyState(message: string): void {
		if (!this.element) return;

		const emptyState = createEmptyState(this.element, { message });
		this.childComponents.push(emptyState);
	}

	private renderNoFlashcardsState(): void {
		if (!this.element) return;

		const stateEl = this.element.createDiv({
			cls: "ep:py-4 ep:text-center",
		});
		stateEl.createEl("p", {
			text: "No flashcards",
			cls: "ep:text-sm ep:text-obs-muted ep:m-0",
		});
	}

	private renderPreviewState(): void {
		const {
			flashcardInfo,
			handlers,
			selectionMode,
			selectedCardIds,
			expandedCardIds,
			cardsWithFsrs,
		} = this.props;

		if (!this.element || !flashcardInfo) return;

		const previewEl = this.element.createDiv({
			cls: "ep:flex ep:flex-col",
		});

		// Flashcard list (compact)
		if (flashcardInfo.flashcards.length > 0) {
			for (const card of flashcardInfo.flashcards) {
				const cardWrapper = previewEl.createDiv();

				// Find FSRS data for this card
				const fsrsCard = cardsWithFsrs?.find((c) => c.id === card.id);

				const compactCard = createCompactCardItem(cardWrapper, {
					card,
					fsrsCard,
					filePath: this.props.currentFile?.path || "",
					app: handlers.app,
					component: handlers.component,
					isExpanded: expandedCardIds.has(card.id),
					isSelected: selectedCardIds.has(card.id),
					isSelectionMode: selectionMode === "selecting",
					onToggleExpand: () => handlers.onToggleExpand?.(card.id),
					onToggleSelect: () => handlers.onToggleSelect?.(card.id),
					onEdit: () => handlers.onEditButton?.(card),
					onDelete: () => handlers.onDeleteCard?.(card),
					onCopy: () => handlers.onCopyCard?.(card),
					onMove: () => handlers.onMoveCard?.(card),
					onSelect: () => handlers.onEnterSelectionMode?.(card.id),
					onLongPress: () => handlers.onEnterSelectionMode?.(card.id),
				});
				this.childComponents.push(compactCard);
			}
		}

		// Add flashcard button at the bottom
		if (handlers.onAdd && selectionMode !== "selecting") {
			const addBtnContainer = previewEl.createDiv({
				cls: "ep:flex ep:justify-center",
			});
			const addBtn = addBtnContainer.createEl("button", {
				cls: "ep:inline-flex ep:items-center ep:gap-1.5 ep:py-1.5 ep:px-3 ep:border ep:border-dashed ep:border-obs-border ep:rounded ep:bg-transparent ep:text-obs-muted ep:text-xs ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:hover:border-obs-modifier-border-hover [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
				attr: { "aria-label": "Add flashcard" },
			});
			setIcon(addBtn, "plus");
			addBtn.createSpan({ text: "Add flashcard" });
			this.events.addEventListener(addBtn, "click", () =>
				handlers.onAdd?.()
			);
		}
	}

	private renderDiffState(): void {
		const { diffResult, currentFile, handlers } = this.props;

		if (!this.element || !diffResult || !currentFile) return;

		const diffEl = this.element.createDiv({
			cls: "ep:py-2",
		});

		// Header with count
		const acceptedCount = diffResult.changes.filter(
			(c) => c.accepted
		).length;
		const totalCount = diffResult.changes.length;

		const headerEl = diffEl.createDiv({
			cls: "ep:flex ep:items-center ep:mb-3",
		});
		headerEl.createSpan({
			text: `Proposed Changes (${acceptedCount}/${totalCount} selected)`,
			cls: "ep:text-sm ep:font-semibold ep:text-obs-normal",
		});

		// Select All / Deselect All button
		const allSelected = acceptedCount === totalCount;
		const selectAllBtn = headerEl.createEl("button", {
			text: allSelected ? "Deselect all" : "Select all",
			cls: "ep:ml-auto ep:px-2 ep:py-1 ep:text-xs ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors",
		});

		if (handlers.onSelectAll) {
			this.events.addEventListener(selectAllBtn, "click", () => {
				handlers.onSelectAll?.(!allSelected);
			});
		}

		// No changes case
		if (diffResult.changes.length === 0) {
			diffEl.createDiv({
				text: "No changes needed. Flashcards are up to date.",
				cls: "ep:text-obs-muted ep:text-center ep:py-6 ep:px-3",
			});
			return;
		}

		// Render each change
		const changesContainer = diffEl.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-3",
		});

		for (let i = 0; i < diffResult.changes.length; i++) {
			const change = diffResult.changes[i];
			if (!change) continue;

			const diffCard = createDiffCard(changesContainer, {
				change,
				index: i,
				filePath: currentFile.path,
				handlers: {
					app: handlers.app,
					component: handlers.component,
					onAccept: (c, idx) =>
						handlers.onChangeAccept?.(c, idx, true),
					onReject: (c, idx) =>
						handlers.onChangeAccept?.(c, idx, false),
					onEditChange: handlers.onEditChange,
				},
				markdownRenderer: handlers.markdownRenderer,
			});
			this.childComponents.push(diffCard);
		}
	}

	private cleanupChildren(): void {
		this.childComponents.forEach((comp) => comp.destroy());
		this.childComponents = [];
	}

	/**
	 * Update the content with new props
	 */
	updateProps(props: Partial<FlashcardPanelContentProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	destroy(): void {
		this.cleanupChildren();
		super.destroy();
	}
}

/**
 * Create a flashcard panel content component
 */
export function createFlashcardPanelContent(
	container: HTMLElement,
	props: FlashcardPanelContentProps
): FlashcardPanelContent {
	const content = new FlashcardPanelContent(container, props);
	content.render();
	return content;
}
