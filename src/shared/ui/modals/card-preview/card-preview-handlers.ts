import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import { notify } from "@shared/services/notification.service";
import { pushDeleteUndo } from "@shared/services/undo.service";
import type { FSRSFlashcardItem } from "@shared/types";
import type { CardsSetter } from "@shared/ui/modals/card-preview/CardPreviewBody";
import type { App } from "obsidian";
import type TrueRecallPlugin from "../../../../main";

export async function handleDeleteCard(
	card: FSRSFlashcardItem,
	setCards: CardsSetter,
	allCards: FSRSFlashcardItem[],
	flashcardManager: FlashcardManager,
	plugin?: TrueRecallPlugin,
): Promise<FSRSFlashcardItem[]> {
	const confirmed = window.confirm("Delete this flashcard?");
	if (!confirmed) return allCards;

	const result = await flashcardManager.removeFlashcardByIdWithDetails(card.id);

	if (result.ok) {
		if (plugin) {
			pushDeleteUndo(plugin, result);
			notify().cardsDeletedWithUndo(result.affectedCount, () => {
				void plugin.undoService?.undo();
			});
		} else {
			notify().cardsDeleted(result.affectedCount);
		}
		const removedIds = new Set(result.affectedIds);
		const updated = allCards.filter((c) => !removedIds.has(c.id));
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
	plugin?: TrueRecallPlugin,
): Promise<void> {
	const confirmed = window.confirm(
		`Delete all ${cards.length} suspended cards?`,
	);
	if (!confirmed) return;

	const result = flashcardManager.removeFlashcardsByIdsWithDetails(
		cards.map((card) => card.id),
	);
	if (result.ok && plugin) {
		pushDeleteUndo(plugin, result);
	}
	const removedIds = new Set(result.affectedIds);
	setCards(cards.filter((card) => !removedIds.has(card.id)));
	if (result.ok && plugin) {
		notify().cardsDeletedWithUndo(result.affectedCount, () => {
			void plugin.undoService?.undo();
		});
	} else {
		notify().cardsDeleted(result.affectedCount);
	}
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
