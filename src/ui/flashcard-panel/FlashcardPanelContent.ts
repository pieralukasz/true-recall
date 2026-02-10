/**
 * Flashcard Panel Content Component
 * Displays the main content area of the flashcard panel
 */
import {
	type App,
	type Component,
	type TFile,
} from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProcessingStatus, SelectionMode } from "../../state/store";
import type {
	FlashcardInfo,
	FlashcardItem,
} from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { createEmptyState, EmptyStateMessages } from "../components/EmptyState";
import { createCompactCardItem } from "./CompactCardItem";
import { createCardGroupItem } from "./CardGroupItem";
import { groupCards } from "./group-cards";

export interface FlashcardPanelContentHandlers {
	app: App;
	component: Component;
	onEditCard?: (card: FlashcardItem) => void;
	onEditButton?: (card: FlashcardItem) => void;
	onCopyCard?: (card: FlashcardItem) => void;
	onDeleteCard?: (card: FlashcardItem) => void;
	onMoveCard?: (card: FlashcardItem) => void;
	// In-place edit save handler
	onEditSave?: (
		card: FlashcardItem,
		field: "question" | "answer",
		newContent: string
	) => Promise<void>;
	// Handlers for compact design
	onToggleExpand?: (cardId: string) => void;
	onToggleSelect?: (cardId: string) => void;
	onEnterSelectionMode?: (cardId: string) => void;
	// Add flashcard handler (opens modal)
	onAdd?: () => void;
	// Group handlers (cloze/reverse)
	onEditGroup?: (cards: FlashcardItem[], clozeTemplate?: string) => void;
	onDeleteGroup?: (cards: FlashcardItem[]) => void;
	onCopyGroup?: (cards: FlashcardItem[]) => void;
	onMoveGroup?: (cards: FlashcardItem[]) => void;
}

export interface FlashcardPanelContentProps {
	currentFile: TFile | null;
	status: ProcessingStatus;
	flashcardInfo: FlashcardInfo | null;
	handlers: FlashcardPanelContentHandlers;
	// Props for compact design
	selectionMode: SelectionMode;
	selectedCardIds: Set<string>;
	expandedCardIds: Set<string>;
	cardsWithFsrs?: FSRSFlashcardItem[];
	// Search query for filtering flashcards
	searchQuery: string;
	// Whether the add card component is expanded
	isAddCardExpanded: boolean;
}

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

		const { currentFile } = this.props;

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
			cls: "ep:text-ui-small ep:text-obs-muted ep:m-0",
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
			searchQuery,
		} = this.props;

		if (!this.element || !flashcardInfo) return;

		const previewEl = this.element.createDiv({
			cls: "ep:flex ep:flex-col",
		});

		// Pre-build Map for O(1) FSRS lookups (instead of O(N*M) .find() calls)
		const fsrsMap = cardsWithFsrs
			? new Map(cardsWithFsrs.map((c) => [c.id, c]))
			: null;

		const filePath = this.props.currentFile?.path || "";

		// Group cards into cloze-groups, reverse-groups, and basic items
		const grouped = groupCards(flashcardInfo.flashcards);

		// Filter grouped items based on search query
		const filteredItems = searchQuery
			? grouped.filter((item) => {
					if (item.type === "basic") {
						return (
							item.card.question.toLowerCase().includes(searchQuery) ||
							item.card.answer.toLowerCase().includes(searchQuery)
						);
					}
					if (item.type === "cloze-group") {
						return item.cards.some(
							(c) =>
								c.question.toLowerCase().includes(searchQuery) ||
								c.answer.toLowerCase().includes(searchQuery)
						);
					}
					// reverse-group
					return (
						item.original.question.toLowerCase().includes(searchQuery) ||
						item.original.answer.toLowerCase().includes(searchQuery) ||
						item.reversed.question.toLowerCase().includes(searchQuery) ||
						item.reversed.answer.toLowerCase().includes(searchQuery)
					);
				})
			: grouped;

		for (const item of filteredItems) {
			if (item.type === "basic") {
				const cardWrapper = previewEl.createDiv();
				const fsrsCard = fsrsMap?.get(item.card.id);
				const compactCard = createCompactCardItem(cardWrapper, {
					card: item.card,
					fsrsCard,
					filePath,
					app: handlers.app,
					component: handlers.component,
					isExpanded: expandedCardIds.has(item.card.id),
					isSelected: selectedCardIds.has(item.card.id),
					isSelectionMode: selectionMode === "selecting",
					onToggleExpand: () => handlers.onToggleExpand?.(item.card.id),
					onToggleSelect: () => handlers.onToggleSelect?.(item.card.id),
					onEdit: () => handlers.onEditButton?.(item.card),
					onDelete: () => handlers.onDeleteCard?.(item.card),
					onCopy: () => handlers.onCopyCard?.(item.card),
					onMove: () => handlers.onMoveCard?.(item.card),
					onSelect: () => handlers.onEnterSelectionMode?.(item.card.id),
					onLongPress: () => handlers.onEnterSelectionMode?.(item.card.id),
				});
				this.childComponents.push(compactCard);
			} else if (item.type === "cloze-group") {
				const groupWrapper = previewEl.createDiv();
				const groupId = `cloze:${item.cards[0]?.id}`;
				const groupItem = createCardGroupItem(groupWrapper, {
					groupType: "cloze",
					cards: item.cards,
					fsrsCards: item.cards.map((c) => fsrsMap?.get(c.id)),
					template: item.template,
					filePath,
					app: handlers.app,
					component: handlers.component,
					isExpanded: expandedCardIds.has(groupId),
					isSelected: item.cards.some((c) => selectedCardIds.has(c.id)),
					isSelectionMode: selectionMode === "selecting",
					onToggleExpand: () => handlers.onToggleExpand?.(groupId),
					onToggleSelect: () => {
						for (const c of item.cards) handlers.onToggleSelect?.(c.id);
					},
					onEditGroup: () => handlers.onEditGroup?.(item.cards, item.template),
					onDeleteGroup: () => handlers.onDeleteGroup?.(item.cards),
					onCopyGroup: () => handlers.onCopyGroup?.(item.cards),
					onMoveGroup: () => handlers.onMoveGroup?.(item.cards),
					onSelect: () => handlers.onEnterSelectionMode?.(item.cards[0]?.id ?? ""),
					onLongPress: () => handlers.onEnterSelectionMode?.(item.cards[0]?.id ?? ""),
				});
				this.childComponents.push(groupItem);
			} else {
				// reverse-group
				const groupWrapper = previewEl.createDiv();
				const groupId = `reverse:${item.original.id}`;
				const cards = [item.original, item.reversed];
				const groupItem = createCardGroupItem(groupWrapper, {
					groupType: "reverse",
					cards,
					fsrsCards: cards.map((c) => fsrsMap?.get(c.id)),
					filePath,
					app: handlers.app,
					component: handlers.component,
					isExpanded: expandedCardIds.has(groupId),
					isSelected: cards.some((c) => selectedCardIds.has(c.id)),
					isSelectionMode: selectionMode === "selecting",
					onToggleExpand: () => handlers.onToggleExpand?.(groupId),
					onToggleSelect: () => {
						for (const c of cards) handlers.onToggleSelect?.(c.id);
					},
					onEditGroup: () => handlers.onEditGroup?.(cards),
					onDeleteGroup: () => handlers.onDeleteGroup?.(cards),
					onCopyGroup: () => handlers.onCopyGroup?.(cards),
					onMoveGroup: () => handlers.onMoveGroup?.(cards),
					onSelect: () => handlers.onEnterSelectionMode?.(item.original.id),
					onLongPress: () => handlers.onEnterSelectionMode?.(item.original.id),
				});
				this.childComponents.push(groupItem);
			}
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
