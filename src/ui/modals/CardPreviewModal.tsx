import { type App, Component } from "obsidian";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
import { type FlashcardManager, notify } from "../../services";
import type { CardMaturityBreakdown, FSRSFlashcardItem } from "../../types";
import { BaseModal } from "./BaseModal";

export interface CardPreviewModalOptions {
	title: string;
	cards: FSRSFlashcardItem[];
	flashcardManager: FlashcardManager;
	category?: keyof CardMaturityBreakdown;
}

interface CardItemProps {
	card: FSRSFlashcardItem;
	onDelete: (card: FSRSFlashcardItem) => void;
	onOpen: (card: FSRSFlashcardItem) => void;
	onUnbury?: (card: FSRSFlashcardItem) => void;
}

const btnCls =
	"ep:p-1.5 ep:rounded-md ep:bg-transparent ep:border-none ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors ep:text-ui-smaller";

function CardItem({ card, onDelete, onOpen, onUnbury }: CardItemProps) {
	const question = (card.question ?? "No question").slice(0, 100);
	const answer = (card.answer ?? "No answer").slice(0, 80);

	return (
		<div class="ep:p-3 ep:border ep:border-obs-border ep:rounded-lg ep:bg-obs-secondary">
			<div class="ep:text-ui-small ep:text-obs-normal ep:mb-1">{question}</div>
			<div class="ep:text-ui-smaller ep:text-obs-muted">{answer}</div>
			<div class="ep:flex ep:gap-2 ep:mt-2">
				<button type="button" class={btnCls} onClick={() => onOpen(card)}>
					Open
				</button>
				{onUnbury && (
					<button type="button" class={btnCls} onClick={() => onUnbury(card)}>
						Unbury
					</button>
				)}
				<button type="button" class={btnCls} onClick={() => onDelete(card)}>
					Delete
				</button>
			</div>
		</div>
	);
}

function CardPreviewBody({
	initialCards,
	category,
	onDeleteCard,
	onOpenCard,
	onUnburyCard,
	onUnburyAll,
	onDeleteAll,
	onUpdateTitle,
}: {
	initialCards: FSRSFlashcardItem[];
	category?: keyof CardMaturityBreakdown;
	onDeleteCard: (
		card: FSRSFlashcardItem,
		setCards: (cards: FSRSFlashcardItem[]) => void,
	) => void;
	onOpenCard: (card: FSRSFlashcardItem) => void;
	onUnburyCard: (
		card: FSRSFlashcardItem,
		setCards: (cards: FSRSFlashcardItem[]) => void,
	) => void;
	onUnburyAll: (
		cards: FSRSFlashcardItem[],
		setCards: (cards: FSRSFlashcardItem[]) => void,
	) => void;
	onDeleteAll: (
		cards: FSRSFlashcardItem[],
		setCards: (cards: FSRSFlashcardItem[]) => void,
	) => void;
	onUpdateTitle: (title: string) => void;
}) {
	const [cards, setCards] = useState(initialCards);

	const wrappedSetCards = useCallback(
		(newCards: FSRSFlashcardItem[]) => {
			setCards(newCards);
			onUpdateTitle(`${newCards.length} cards`);
		},
		[onUpdateTitle],
	);

	return (
		<>
			<div class="ep:flex ep:justify-between ep:items-center ep:mb-4">
				<div class="ep:text-ui-small ep:text-obs-muted">
					{cards.length} cards
				</div>
				{category === "buried" && cards.length > 0 && (
					<button
						type="button"
						class="ep:text-ui-smaller ep:py-1.5 ep:px-3 ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:rounded-md ep:cursor-pointer ep:transition-colors ep:hover:opacity-90"
						onClick={() => onUnburyAll(cards, wrappedSetCards)}
					>
						Unbury all
					</button>
				)}
				{category === "suspended" && cards.length > 0 && (
					<button
						type="button"
						class="ep:text-ui-smaller ep:py-1.5 ep:px-3 ep:bg-obs-red ep:text-obs-on-accent ep:border-none ep:rounded-md ep:cursor-pointer ep:transition-colors ep:hover:opacity-90"
						onClick={() => onDeleteAll(cards, wrappedSetCards)}
					>
						Delete all
					</button>
				)}
			</div>

			<div class="ep:max-h-[60vh] ep:overflow-y-auto ep:flex ep:flex-col ep:gap-3">
				{cards.length === 0 ? (
					<div class="ep:text-center ep:text-obs-muted ep:py-8 ep:italic">
						No cards in this category
					</div>
				) : (
					cards.map((card) => (
						<CardItem
							key={card.id}
							card={card}
							onDelete={(c) => onDeleteCard(c, wrappedSetCards)}
							onOpen={onOpenCard}
							onUnbury={
								category === "buried"
									? (c) => onUnburyCard(c, wrappedSetCards)
									: undefined
							}
						/>
					))
				)}
			</div>
		</>
	);
}

export class CardPreviewModal extends BaseModal {
	private options: CardPreviewModalOptions;
	private component: Component;
	private flashcardManager: FlashcardManager;
	private unmountBody?: () => void;

	constructor(app: App, options: CardPreviewModalOptions) {
		super(app, { title: options.title, width: "700px" });
		this.options = options;
		this.component = new Component();
		this.flashcardManager = options.flashcardManager;
	}

	onOpen(): void {
		this.component.load();
		super.onOpen();
		this.contentEl.addClass("true-recall-card-preview-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CardPreviewBody
				initialCards={this.options.cards}
				category={this.options.category}
				onDeleteCard={(card, setCards) =>
					void this.handleDeleteCard(card, setCards)
				}
				onOpenCard={(card) => void this.openSourceNote(card)}
				onUnburyCard={(card, setCards) =>
					void this.handleUnburyCard(card, setCards)
				}
				onUnburyAll={(cards, setCards) =>
					void this.handleUnburyAll(cards, setCards)
				}
				onDeleteAll={(cards, setCards) =>
					void this.handleDeleteAll(cards, setCards)
				}
				onUpdateTitle={(title) => this.updateTitle(title)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		this.component.unload();
		const { contentEl } = this;
		contentEl.empty();
	}

	private async handleDeleteCard(
		card: FSRSFlashcardItem,
		setCards: (cards: FSRSFlashcardItem[]) => void,
	): Promise<void> {
		// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
		const confirmed = window.confirm(
			"Delete this flashcard? This action cannot be undone.",
		);
		if (!confirmed) return;

		const success = await this.flashcardManager.removeFlashcardById(card.id);

		if (success) {
			notify().cardsDeleted(1);
			this.options.cards = this.options.cards.filter((c) => c.id !== card.id);
			setCards(this.options.cards);
		} else {
			notify().operationFailed("delete flashcard");
		}
	}

	private async openSourceNote(card: FSRSFlashcardItem): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);

		if (card.sourceNoteName) {
			const sourceFile = this.app.vault
				.getMarkdownFiles()
				.find((f) => f.basename === card.sourceNoteName);
			if (sourceFile) {
				await leaf.openFile(sourceFile);
				this.close();
				return;
			}
		}

		notify().warning("Could not find source note for this card");
	}

	private async handleUnburyCard(
		card: FSRSFlashcardItem,
		setCards: (cards: FSRSFlashcardItem[]) => void,
	): Promise<void> {
		const fullCard = this.options.cards.find((c) => c.id === card.id);
		if (!fullCard) {
			notify().error("Could not find card");
			return;
		}

		const updatedFsrs = { ...fullCard.fsrs, buriedUntil: undefined };

		try {
			this.flashcardManager.updateCardFSRS(fullCard.id, updatedFsrs);
			this.options.cards = this.options.cards.filter((c) => c.id !== card.id);
			setCards(this.options.cards);
			notify().cardsStatusChanged(1, "unburied");
		} catch (error) {
			console.error("Error unburying card:", error);
			notify().operationFailed("unbury card", error);
		}
	}

	private async handleUnburyAll(
		cards: FSRSFlashcardItem[],
		setCards: (cards: FSRSFlashcardItem[]) => void,
	): Promise<void> {
		let unburiedCount = 0;

		for (const card of cards) {
			const updatedFsrs = { ...card.fsrs, buriedUntil: undefined };
			try {
				this.flashcardManager.updateCardFSRS(card.id, updatedFsrs);
				unburiedCount++;
			} catch (error) {
				console.error(`Error unburying card ${card.id}:`, error);
			}
		}

		this.options.cards = [];
		setCards([]);
		notify().cardsStatusChanged(unburiedCount, "unburied");
	}

	private async handleDeleteAll(
		cards: FSRSFlashcardItem[],
		setCards: (cards: FSRSFlashcardItem[]) => void,
	): Promise<void> {
		// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
		const confirmed = window.confirm(
			`Delete all ${cards.length} suspended cards? This action cannot be undone.`,
		);
		if (!confirmed) return;

		let deletedCount = 0;

		for (const card of cards) {
			const success = await this.flashcardManager.removeFlashcardById(card.id);
			if (success) {
				deletedCount++;
			}
		}

		this.options.cards = [];
		setCards([]);
		notify().cardsDeleted(deletedCount);
	}
}
