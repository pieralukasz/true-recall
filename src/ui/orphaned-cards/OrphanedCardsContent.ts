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
	cards: OrphanedCard[];
	app: App;
	component: Component;
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

		// Card list
		this.renderCardList();
	}

	private renderCardList(): void {
		const cardsContainer = this.element!.createDiv({
			cls: "episteme-cards-container",
		});

		if (this.props.isLoading) {
			cardsContainer.createEl("div", {
				text: "Loading orphaned cards...",
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		const cards = this.props.cards;

		if (cards.length === 0) {
			cardsContainer.createEl("div", {
				text: "No orphaned cards found. All cards have assigned source notes.",
				cls: "episteme-panel-list-empty",
			});
			return;
		}

		for (let index = 0; index < cards.length; index++) {
			const card = cards[index];
			if (!card) continue;

			this.renderCardItem(cardsContainer, card);

			// Separator (except for last card)
			if (index < cards.length - 1) {
				cardsContainer.createDiv({
					cls: "episteme-card-separator",
				});
			}
		}
	}

	private renderCardItem(container: HTMLElement, card: OrphanedCard): void {
		const { app, component, onEditSave, onEditButton, onCopyCard } = this.props;

		const cardWrapper = container.createDiv();

		// Create CardReviewItem with adapted card data
		const cardItem = createCardReviewItem(cardWrapper, {
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
	}

	updateProps(props: Partial<OrphanedCardsContentProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
