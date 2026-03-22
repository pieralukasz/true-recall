import { getSourceNoteNameFromFile } from "@features/library/ui/panel/utils/panel-helpers";
import { pushDeleteUndo } from "@shared/services/undo.service";
import { useApp, usePlugin } from "@shared/ui/preact";
import { useCallback } from "preact/hooks";

import { usePanelStore } from "./usePanelStore";

export interface UseSelectionActionsParams {
	preserveScroll: (action: () => void) => void;
}

export function useSelectionActions({
	preserveScroll,
}: UseSelectionActionsParams) {
	const plugin = usePlugin();
	const app = useApp();
	const { flashcardInfo, currentFile, selectedCardIds, panel } =
		usePanelStore();

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

		const successCount = results.filter((r) => r.status === "fulfilled").length;
		results.forEach((r, i) => {
			if (r.status === "rejected") {
				console.error(`Failed to move card ${selectedCards[i]?.id}:`, r.reason);
			}
		});

		panel.exitSelectionMode();
		notify().success(`Moved ${successCount} of ${selectedCards.length} cards`);
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
		const result =
			plugin.flashcardManager.removeFlashcardsByIdsWithDetails(cardIds);

		if (result.ok) {
			pushDeleteUndo(plugin, result);
		}

		panel.exitSelectionMode();
		notify().cardsDeletedWithUndo(result.affectedCount, () => {
			void plugin.undoService?.undo();
		});
	}, [flashcardInfo, currentFile, selectedCardIds, plugin, panel]);

	const handleChangeNoteType = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { ChangeNoteTypeModal } = await import(
			"@features/library/modals/ChangeNoteTypeModal"
		);
		const { notify } = await import("@shared/services/notification.service");
		const { notifyCardChange } = await import("@shared/services/signals");

		const cardIds = Array.from(selectedCardIds);
		const noteInfos = plugin.cardStore.cards.getNoteInfoForCardIds(cardIds);
		if (noteInfos.length === 0) return;

		const uniqueTypeIds = new Set(noteInfos.map((n) => n.noteTypeId));
		if (uniqueTypeIds.size > 1) {
			notify().error(
				"Selected cards have different note types. Select cards of one type.",
			);
			return;
		}

		const firstNoteInfo = noteInfos[0];
		if (!firstNoteInfo) return;
		const currentTypeId = firstNoteInfo.noteTypeId;
		const currentNoteType = plugin.cardStore.noteTypes.getById(currentTypeId);
		if (!currentNoteType) return;

		const allNoteTypes = plugin.cardStore.noteTypes.getAll();

		const modal = new ChangeNoteTypeModal(app, {
			currentNoteType,
			availableNoteTypes: allNoteTypes,
			noteCount: noteInfos.length,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
			return;

		let totalCreated = 0;
		let totalDeleted = 0;

		for (const info of noteInfos) {
			const r = plugin.flashcardManager.changeNoteType(
				info.noteId,
				result.targetNoteTypeId,
				result.fieldMapping,
			);
			totalCreated += r.createdCardIds.length;
			totalDeleted += r.deletedCardIds.length;
		}

		const parts: string[] = [`${noteInfos.length} note(s) changed`];
		if (totalCreated > 0) parts.push(`${totalCreated} cards created`);
		if (totalDeleted > 0) parts.push(`${totalDeleted} cards removed`);
		notifyCardChange({
			type: "bulk",
			cardIds,
			action: "update",
		});
		notify().success(parts.join(", "));
		panel.exitSelectionMode();
	}, [flashcardInfo, selectedCardIds, app, plugin, panel]);

	const handleSuspendSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { notify } = await import("@shared/services/notification.service");
		const { notifyCardChange } = await import("@shared/services/signals");

		const cardIds = Array.from(selectedCardIds);
		const count = plugin.cardStore.cards.bulkSuspend(cardIds);
		notifyCardChange({ type: "bulk", cardIds, action: "suspend" });
		panel.exitSelectionMode();
		notify().success(`Suspended ${count} card(s)`);
	}, [flashcardInfo, selectedCardIds, plugin, panel]);

	const handleUnsuspendSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { notify } = await import("@shared/services/notification.service");
		const { notifyCardChange } = await import("@shared/services/signals");

		const cardIds = Array.from(selectedCardIds);
		const count = plugin.cardStore.cards.bulkUnsuspend(cardIds);
		notifyCardChange({ type: "bulk", cardIds, action: "unsuspend" });
		panel.exitSelectionMode();
		notify().success(`Unsuspended ${count} card(s)`);
	}, [flashcardInfo, selectedCardIds, plugin, panel]);

	const handleForgetSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { notify } = await import("@shared/services/notification.service");
		const { notifyCardChange } = await import("@shared/services/signals");

		const cardIds = Array.from(selectedCardIds);
		const count = plugin.cardStore.cards.bulkForget(cardIds);
		if (count === 0) {
			notify().warning("Forget is only available for non-New cards");
			return;
		}
		plugin.sessionPersistence?.removeReviewedCards(cardIds);
		notifyCardChange({ type: "bulk", cardIds, action: "reset" });
		panel.exitSelectionMode();
		notify().cardsForgotten(count);
	}, [flashcardInfo, selectedCardIds, plugin, panel]);

	return {
		handleToggleSelect,
		handleEnterSelectionMode,
		handleExitSelectionMode,
		handleSelectAll,
		handleMoveSelected,
		handleChangeNoteType,
		handleSuspendSelected,
		handleUnsuspendSelected,
		handleForgetSelected,
		handleDeleteSelected,
	};
}
