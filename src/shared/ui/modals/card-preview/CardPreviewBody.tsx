import type { CardMaturityBreakdown, FSRSFlashcardItem } from "@shared/types";
import { Clickable } from "@shared/ui/components";
import { useCallback, useState } from "preact/hooks";

interface CardItemProps {
	card: FSRSFlashcardItem;
	onDelete: (card: FSRSFlashcardItem) => void;
	onOpen: (card: FSRSFlashcardItem) => void;
	onUnbury?: (card: FSRSFlashcardItem) => void;
}

const btnCls =
	"ep:p-1.5 ep:rounded-md ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors ep:text-ui-smaller";

function CardItem({ card, onDelete, onOpen, onUnbury }: CardItemProps) {
	const question = (card.question ?? "No question").slice(0, 100);
	const answer = (card.answer ?? "No answer").slice(0, 80);

	return (
		<div class="ep:p-3 ep:border ep:border-obs-border ep:rounded-lg ep:bg-obs-secondary">
			<div class="ep:text-ui-small ep:text-obs-normal ep:mb-1">{question}</div>
			<div class="ep:text-ui-smaller ep:text-obs-muted">{answer}</div>
			<div class="ep:flex ep:gap-2 ep:mt-2">
				<Clickable class={btnCls} onClick={() => onOpen(card)}>
					Open
				</Clickable>
				{onUnbury && (
					<Clickable class={btnCls} onClick={() => onUnbury(card)}>
						Unbury
					</Clickable>
				)}
				<Clickable class={btnCls} onClick={() => onDelete(card)}>
					Delete
				</Clickable>
			</div>
		</div>
	);
}

export type CardsSetter = (cards: FSRSFlashcardItem[]) => void;

export interface CardPreviewBodyProps {
	initialCards: FSRSFlashcardItem[];
	category?: keyof CardMaturityBreakdown;
	onDeleteCard: (card: FSRSFlashcardItem, setCards: CardsSetter) => void;
	onOpenCard: (card: FSRSFlashcardItem) => void;
	onUnburyCard: (card: FSRSFlashcardItem, setCards: CardsSetter) => void;
	onUnburyAll: (cards: FSRSFlashcardItem[], setCards: CardsSetter) => void;
	onDeleteAll: (cards: FSRSFlashcardItem[], setCards: CardsSetter) => void;
	onUpdateTitle: (title: string) => void;
}

export function CardPreviewBody({
	initialCards,
	category,
	onDeleteCard,
	onOpenCard,
	onUnburyCard,
	onUnburyAll,
	onDeleteAll,
	onUpdateTitle,
}: CardPreviewBodyProps) {
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
					<Clickable
						class="ep:text-ui-smaller ep:py-1.5 ep:px-3 ep:bg-obs-interactive ep:text-obs-on-accent ep:rounded-md ep:transition-colors ep:hover:opacity-90"
						onClick={() => onUnburyAll(cards, wrappedSetCards)}
					>
						Unbury all
					</Clickable>
				)}
				{category === "suspended" && cards.length > 0 && (
					<Clickable
						class="ep:text-ui-smaller ep:py-1.5 ep:px-3 ep:bg-obs-red ep:text-obs-on-accent ep:rounded-md ep:transition-colors ep:hover:opacity-90"
						onClick={() => onDeleteAll(cards, wrappedSetCards)}
					>
						Delete all
					</Clickable>
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
