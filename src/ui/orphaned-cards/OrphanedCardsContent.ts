/**
 * Orphaned Cards Content Component
 * Contains search, selection controls, and card list
 */
import type { App, Component } from "obsidian";
import { BaseComponent } from "../component.base";
import { createCardReviewItem, type CardReviewItem } from "../components/CardReviewItem";
import type { OrphanedCard } from "../../state/state.types";

export interface OrphanedCardsContentProps {
	isLoading: boolean;
	filteredCards: OrphanedCard[];
	totalCount: number;
	searchQuery: string;
	selectedCardIds: Set<string>;
	app: App;
	component: Component;
	onSearchChange: (query: string) => void;
	onCardSelect: (cardId: string) => void;
	onSelectAll: () => void;
	onClearSelection: () => void;
	onAssignCard: (cardId: string) => void;
	onDeleteCard: (cardId: string) => void;
	onEditSave?: (card: OrphanedCard, field: "question" | "answer", newContent: string) => Promise<void>;
	onEditButton?: (card: OrphanedCard) => void;
	onCopyCard?: (card: OrphanedCard) => void;
}

/**
 * Content component for orphaned cards view
 */
export class OrphanedCardsContent extends BaseComponent {
	private props: OrphanedCardsContentProps;
	private searchInput: HTMLInputElement | null = null;
	private cardItems: CardReviewItem[] = [];

	constructor(container: HTMLElement, props: OrphanedCardsContentProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		// Clean up card items
		for (const item of this.cardItems) {
			item.destroy();
		}
		this.cardItems = [];

		this.element = this.container.createDiv({
			cls: "episteme-panel-content",
		});

		// Search input
		this.renderSearchInput();

		// Selection controls
		this.renderSelectionControls();

		// Card list
		this.renderCardList();
	}

	private renderSearchInput(): void {
		const searchContainer = this.element!.createDiv({
			cls: "episteme-search-container",
		});

		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search cards...",
			cls: "episteme-search-input",
		});
		this.searchInput.value = this.props.searchQuery;

		this.events.addEventListener(this.searchInput, "input", (e) => {
			const query = (e.target as HTMLInputElement).value.toLowerCase();
			this.props.onSearchChange(query);
		});
	}

	private renderSelectionControls(): void {
		const controlsEl = this.element!.createDiv({
			cls: "episteme-panel-selection-controls",
		});

		const selectAllBtn = controlsEl.createEl("button", {
			text: "Select all",
			cls: "episteme-panel-selection-btn",
		});
		this.events.addEventListener(selectAllBtn, "click", () => {
			this.props.onSelectAll();
		});

		const clearBtn = controlsEl.createEl("button", {
			text: "Clear selection",
			cls: "episteme-panel-selection-btn",
		});
		this.events.addEventListener(clearBtn, "click", () => {
			this.props.onClearSelection();
		});
	}

	private renderCardList(): void {
		const cardListEl = this.element!.createDiv({
			cls: "episteme-panel-list",
		});

		if (this.props.isLoading) {
			cardListEl.createEl("div", {
				text: "Loading orphaned cards...",
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		const filteredCards = this.props.filteredCards;

		if (filteredCards.length === 0) {
			const emptyText = this.props.searchQuery
				? "No cards found matching your search."
				: this.props.totalCount === 0
					? "No orphaned cards found. All cards have assigned source notes."
					: "No cards match the current filter.";
			cardListEl.createEl("div", {
				text: emptyText,
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		// Show max 50 cards
		const displayCards = filteredCards.slice(0, 50);

		for (const card of displayCards) {
			this.renderCardItem(cardListEl, card);
		}

		// Show "more results" message if truncated
		if (filteredCards.length > 50) {
			cardListEl.createEl("div", {
				text: `Showing 50 of ${filteredCards.length} cards. Type to search for more.`,
				cls: "episteme-panel-list-more",
			});
		}
	}

	private renderCardItem(container: HTMLElement, card: OrphanedCard): void {
		const isSelected = this.props.selectedCardIds.has(card.id);
		const { app, component, onEditSave, onEditButton, onCopyCard } = this.props;

		// Wrapper for checkbox + card
		const cardWrapper = container.createDiv({
			cls: `episteme-panel-item episteme-orphaned-card-wrapper ${isSelected ? "selected" : ""}`,
		});

		// Checkbox container (left side)
		const checkboxContainer = cardWrapper.createDiv({
			cls: "episteme-panel-checkbox-container",
		});
		const checkbox = checkboxContainer.createEl("input", {
			type: "checkbox",
			cls: "episteme-panel-checkbox",
		});
		checkbox.checked = isSelected;
		this.events.addEventListener(checkbox, "change", () => {
			this.props.onCardSelect(card.id);
		});

		// Card content container (right side)
		const cardContainer = cardWrapper.createDiv({
			cls: "episteme-orphaned-card-content",
		});

		// Create CardReviewItem with adapted card data
		const cardItem = createCardReviewItem(cardContainer, {
			card: {
				id: card.id,
				question: card.question,
				answer: card.answer,
			},
			filePath: "",
			app,
			component,
			onDelete: () => this.props.onDeleteCard(card.id),
			onCopy: onCopyCard ? () => onCopyCard(card) : undefined,
			onMove: () => this.props.onAssignCard(card.id), // Use Move as Assign for orphaned
			onEditButton: onEditButton ? () => onEditButton(card) : undefined,
			onEditSave: onEditSave
				? async (_, field, newContent) => {
						await onEditSave(card, field, newContent);
					}
				: undefined,
		});
		this.cardItems.push(cardItem);

		// Click on wrapper (outside card item) toggles selection
		this.events.addEventListener(cardWrapper, "click", (e) => {
			const target = e.target as HTMLElement;
			// Only toggle if clicking directly on wrapper or checkbox container
			if (target === cardWrapper || target === checkboxContainer || target === checkbox) {
				if (target !== checkbox) {
					this.props.onCardSelect(card.id);
				}
			}
		});
	}

	updateProps(props: Partial<OrphanedCardsContentProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	focusSearch(): void {
		setTimeout(() => this.searchInput?.focus(), 50);
	}
}
