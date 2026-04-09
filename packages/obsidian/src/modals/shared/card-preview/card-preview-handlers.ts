import type { App } from "obsidian";

import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { FSRSFlashcardItem } from "@true-recall/core/types";

import { UnburyCommand } from "@true-recall/obsidian/commands/commands/card-bury.cmd";
import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type TrueRecallPlugin from "../../../main";
import type { CardsSetter } from "./CardPreviewBody";

export async function handleDeleteCard(
	app: App,
	card: FSRSFlashcardItem,
	setCards: CardsSetter,
	allCards: FSRSFlashcardItem[],
	_flashcardManager: FlashcardManager,
	plugin?: TrueRecallPlugin,
): Promise<FSRSFlashcardItem[]> {
	const confirmed = await confirm(app, {
		message: "Delete this flashcard?",
	});
	if (!confirmed) return allCards;

	if (plugin?.commandService) {
		const cmd = new DeleteCardCommand([card.id]);
		await plugin.commandService.execute(cmd);

		if (cmd.deletedCount > 0) {
			notify().cardsDeletedWithUndo(cmd.deletedCount, () => {
				void plugin.commandService?.undo();
			});
			const removedIds = new Set([card.id]);
			const updated = allCards.filter((c) => !removedIds.has(c.id));
			setCards(updated);
			return updated;
		}
	} else {
		notify().operationFailed("delete flashcard");
	}

	return allCards;
}

export function handleUnburyCard(
	card: FSRSFlashcardItem,
	setCards: CardsSetter,
	allCards: FSRSFlashcardItem[],
	_flashcardManager: FlashcardManager,
	plugin?: TrueRecallPlugin,
): FSRSFlashcardItem[] {
	const fullCard = allCards.find((c) => c.id === card.id);
	if (!fullCard) {
		notify().error("Could not find card");
		return allCards;
	}

	if (plugin?.commandService) {
		const cmd = new UnburyCommand([card.id]);
		void plugin.commandService.execute(cmd);
		const updated = allCards.filter((c) => c.id !== card.id);
		setCards(updated);
		notify().cardsStatusChanged(1, "unburied");
		return updated;
	}

	// Fallback without command service
	const updatedFsrs = { ...fullCard.fsrs, buriedUntil: undefined };
	try {
		plugin?.flashcardManager.updateCardFSRS(fullCard.id, updatedFsrs);
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

export function handleUnburyAll(
	cards: FSRSFlashcardItem[],
	setCards: CardsSetter,
	_flashcardManager: FlashcardManager,
	plugin?: TrueRecallPlugin,
): void {
	if (plugin?.commandService) {
		const cmd = new UnburyCommand(cards.map((c) => c.id));
		void plugin.commandService.execute(cmd);
		setCards([]);
		notify().cardsStatusChanged(cards.length, "unburied");
		return;
	}

	// Fallback
	let unburiedCount = 0;
	const failedCards: FSRSFlashcardItem[] = [];

	for (const card of cards) {
		const updatedFsrs = { ...card.fsrs, buriedUntil: undefined };
		try {
			plugin?.flashcardManager.updateCardFSRS(card.id, updatedFsrs);
			unburiedCount++;
		} catch (error) {
			console.error(`Error unburying card ${card.id}:`, error);
			failedCards.push(card);
		}
	}

	setCards(failedCards);

	if (failedCards.length > 0 && unburiedCount > 0) {
		notify().warning(
			`Unburied ${unburiedCount} of ${cards.length} cards, ${failedCards.length} failed`,
		);
	} else if (failedCards.length > 0) {
		notify().operationFailed("unbury cards");
	} else {
		notify().cardsStatusChanged(unburiedCount, "unburied");
	}
}

export async function handleDeleteAll(
	app: App,
	cards: FSRSFlashcardItem[],
	setCards: CardsSetter,
	_flashcardManager: FlashcardManager,
	plugin?: TrueRecallPlugin,
): Promise<void> {
	const confirmed = await confirm(app, {
		message: `Delete all ${cards.length} suspended cards?`,
	});
	if (!confirmed) return;

	if (plugin?.commandService) {
		const cmd = new DeleteCardCommand(cards.map((c) => c.id));
		await plugin.commandService.execute(cmd);
		setCards([]);
		notify().cardsDeletedWithUndo(cmd.deletedCount, () => {
			void plugin.commandService?.undo();
		});
	} else {
		notify().operationFailed("delete cards");
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
