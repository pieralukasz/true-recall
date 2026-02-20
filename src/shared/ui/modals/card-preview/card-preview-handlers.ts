import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { notify } from "@shared/services/notification.service";
import type { FSRSFlashcardItem } from "@shared/types";
import type { CardsSetter } from "@shared/ui/modals/card-preview/CardPreviewBody";
import type { App } from "obsidian";

export async function handleDeleteCard(
	card: FSRSFlashcardItem,
	setCards: CardsSetter,
	allCards: FSRSFlashcardItem[],
	flashcardManager: FlashcardManager,
): Promise<FSRSFlashcardItem[]> {
	// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
	const confirmed = window.confirm(
		"Delete this flashcard? This action cannot be undone.",
	);
	if (!confirmed) return allCards;

	const success = await flashcardManager.removeFlashcardById(card.id);

	if (success) {
		notify().cardsDeleted(1);
		const updated = allCards.filter((c) => c.id !== card.id);
		setCards(updated);
		return updated;
	}

	notify().operationFailed("delete flashcard");
	return allCards;
}

export async function handleUnburyCard(
	card: FSRSFlashcardItem,
	setCards: CardsSetter,
	allCards: FSRSFlashcardItem[],
	flashcardManager: FlashcardManager,
): Promise<FSRSFlashcardItem[]> {
	const fullCard = allCards.find((c) => c.id === card.id);
	if (!fullCard) {
		notify().error("Could not find card");
		return allCards;
	}

	const updatedFsrs = { ...fullCard.fsrs, buriedUntil: undefined };

	try {
		flashcardManager.updateCardFSRS(fullCard.id, updatedFsrs);
		const updated = allCards.filter((c) => c.id !== card.id);
		setCards(updated);
		notify().cardsStatusChanged(1, "unburied");
		return updated;
	} catch (error) {
		console.error("Error unburying card:", error);
		notify().operationFailed("unbury card", error);
		return allCards;
	}
}

export async function handleUnburyAll(
	cards: FSRSFlashcardItem[],
	setCards: CardsSetter,
	flashcardManager: FlashcardManager,
): Promise<void> {
	let unburiedCount = 0;

	for (const card of cards) {
		const updatedFsrs = { ...card.fsrs, buriedUntil: undefined };
		try {
			flashcardManager.updateCardFSRS(card.id, updatedFsrs);
			unburiedCount++;
		} catch (error) {
			console.error(`Error unburying card ${card.id}:`, error);
		}
	}

	setCards([]);
	notify().cardsStatusChanged(unburiedCount, "unburied");
}

export async function handleDeleteAll(
	cards: FSRSFlashcardItem[],
	setCards: CardsSetter,
	flashcardManager: FlashcardManager,
): Promise<void> {
	// eslint-disable-next-line no-alert -- destructive operation requires explicit user confirmation
	const confirmed = window.confirm(
		`Delete all ${cards.length} suspended cards? This action cannot be undone.`,
	);
	if (!confirmed) return;

	let deletedCount = 0;

	for (const card of cards) {
		const success = await flashcardManager.removeFlashcardById(card.id);
		if (success) {
			deletedCount++;
		}
	}

	setCards([]);
	notify().cardsDeleted(deletedCount);
}

export async function openSourceNote(
	card: FSRSFlashcardItem,
	app: App,
	closeModal: () => void,
): Promise<void> {
	const leaf = app.workspace.getLeaf(false);

	if (card.sourceNoteName) {
		const sourceFile = app.vault
			.getMarkdownFiles()
			.find((f) => f.basename === card.sourceNoteName);
		if (sourceFile) {
			await leaf.openFile(sourceFile);
			closeModal();
			return;
		}
	}

	notify().warning("Could not find source note for this card");
}
