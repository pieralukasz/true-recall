import { getSourceNoteNameFromFile } from "@features/library/ui/panel/utils/panel-helpers";
import type { PanelApi } from "@shared/store";
import type { FlashcardInfo } from "@shared/types";
import { useApp, usePlugin } from "@shared/ui/preact";
import type { TFile } from "obsidian";
import { useCallback } from "preact/hooks";

export interface UseSelectionActionsParams {
	flashcardInfo: FlashcardInfo | null;
	currentFile: TFile | null;
	selectedCardIds: Set<string>;
	panel: PanelApi;
	preserveScroll: (action: () => void) => void;
}

export function useSelectionActions({
	flashcardInfo,
	currentFile,
	selectedCardIds,
	panel,
	preserveScroll,
}: UseSelectionActionsParams) {
	const plugin = usePlugin();
	const app = useApp();

	const handleToggleSelect = useCallback(
		(cardId: string) => {
			preserveScroll(() => {
				panel.toggleCardSelection(cardId);
			});
		},
		[panel, preserveScroll],
	);

	const handleEnterSelectionMode = useCallback(
		(cardId: string) => {
			panel.enterSelectionMode(cardId);
		},
		[panel],
	);

	const handleExitSelectionMode = useCallback(() => {
		panel.exitSelectionMode();
	}, [panel]);

	const handleSelectAll = useCallback(() => {
		if (!flashcardInfo) return;
		const cardIds = flashcardInfo.flashcards.map((c) => c.id);
		panel.selectAll(cardIds);
	}, [panel, flashcardInfo]);

	const handleMoveSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { MoveCardModal } = await import("@shared/ui/modals/MoveCardModal");
		const { notify } = await import("@shared/services/notification.service");

		const selectedCards = flashcardInfo.flashcards.filter((card) =>
			selectedCardIds.has(card.id),
		);

		if (selectedCards.length === 0) {
			notify().error(
				"No cards with valid UUIDs selected. Please regenerate flashcards.",
			);
			return;
		}

		const firstCard = selectedCards[0];
		if (!firstCard) return;

		const sourceNoteName = await getSourceNoteNameFromFile(
			app,
			currentFile,
			flashcardInfo,
		);

		const modal = new MoveCardModal(app, {
			cardCount: selectedCards.length,
			sourceNoteName,
			cardQuestion: firstCard.question,
			cardAnswer: firstCard.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		const targetPath = result.targetNotePath;
		const results = await Promise.allSettled(
			selectedCards.map((card) =>
				plugin.flashcardManager.moveCard(card.id, targetPath),
			),
		);

		const successCount = results.filter(
			(r) => r.status === "fulfilled",
		).length;
		results.forEach((r, i) => {
			if (r.status === "rejected") {
				console.error(
					`Failed to move card ${selectedCards[i]?.id}:`,
					r.reason,
				);
			}
		});

		panel.exitSelectionMode();
		notify().success(
			`Moved ${successCount} of ${selectedCards.length} cards`,
		);
	}, [flashcardInfo, selectedCardIds, currentFile, app, plugin, panel]);

	const handleDeleteSelected = useCallback(async () => {
		if (!flashcardInfo || !currentFile || selectedCardIds.size === 0) return;
		const { notify } = await import("@shared/services/notification.service");

		const selectedCards = flashcardInfo.flashcards.filter((card) =>
			selectedCardIds.has(card.id),
		);
		if (selectedCards.length === 0) return;

		const confirmed = window.confirm(
			`Delete ${selectedCards.length} selected card(s)?`,
		);
		if (!confirmed) return;

		const cardIds = selectedCards.map((card) => card.id);
		const successCount =
			plugin.flashcardManager.removeFlashcardsByIds(cardIds);

		panel.exitSelectionMode();
		notify().cardsDeleted(successCount);
	}, [flashcardInfo, currentFile, selectedCardIds, plugin, panel]);

	const handleDeleteAll = useCallback(async () => {
		const { notify } = await import("@shared/services/notification.service");
		if (!flashcardInfo || flashcardInfo.flashcards.length === 0) return;

		const count = flashcardInfo.flashcards.length;
		const confirmed = window.confirm(
			`Delete all ${count} flashcard(s) for this note?`,
		);
		if (!confirmed) return;

		const cardIds = flashcardInfo.flashcards.map((card) => card.id);
		const successCount =
			plugin.flashcardManager.removeFlashcardsByIds(cardIds);
		notify().cardsDeleted(successCount);
	}, [flashcardInfo, plugin]);

	return {
		handleToggleSelect,
		handleEnterSelectionMode,
		handleExitSelectionMode,
		handleSelectAll,
		handleMoveSelected,
		handleDeleteSelected,
		handleDeleteAll,
	};
}
