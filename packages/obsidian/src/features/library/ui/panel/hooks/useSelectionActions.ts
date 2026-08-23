import { useCallback } from "preact/hooks";
import { State } from "ts-fsrs";

import type { AIWorkflow } from "@true-recall/core/ai/workflows/ai-workflow";

import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import { ForgetCommand } from "@true-recall/obsidian/commands/commands/card-forget.cmd";
import {
	SuspendCommand,
	UnsuspendCommand,
} from "@true-recall/obsidian/commands/commands/card-suspend.cmd";
import { ChangeNoteTypeCommand } from "@true-recall/obsidian/commands/commands/note-type.cmd";
import { startCardPolish } from "@true-recall/obsidian/features/library/ui/panel/utils/card-polish.utils";
import { getSourceNoteNameFromFile } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";

import { usePanelScroll } from "./PanelScrollContext";
import { usePanelStore } from "./usePanelStore";

export function useSelectionActions() {
	const { preserveScroll } = usePanelScroll();
	const plugin = usePlugin();
	const app = useApp();
	const { flashcardInfo, currentFile, selectedCardIds, cardsWithFsrs, panel } =
		usePanelStore();

	const handleToggleSelect = useCallback(
		(cardId: string) => {
			preserveScroll(() => {
				panel.toggleCardSelection(cardId);
			});
		},
		[panel, preserveScroll],
	);

	const handleSetCardsSelected = useCallback(
		(cardIds: string[], selected: boolean) => {
			preserveScroll(() => {
				panel.setCardsSelected(cardIds, selected);
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

	const handleSelectCards = useCallback(
		(cardIds: string[]) => {
			panel.selectAll(cardIds);
		},
		[panel],
	);

	const handleSelectAll = useCallback(() => {
		if (!flashcardInfo) return;
		handleSelectCards(flashcardInfo.flashcards.map((card) => card.id));
	}, [flashcardInfo, handleSelectCards]);

	const handleMoveSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { MoveCardModal } = await import(
			"@true-recall/obsidian/modals/shared/MoveCardModal"
		);
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);

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
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);
		const { confirm } = await import(
			"@true-recall/obsidian/modals/shared/ConfirmModal"
		);

		const selectedCards = flashcardInfo.flashcards.filter((card) =>
			selectedCardIds.has(card.id),
		);
		if (selectedCards.length === 0) return;

		const confirmed = await confirm(app, {
			message: `Delete ${selectedCards.length} selected card(s)?`,
		});
		if (!confirmed) return;

		const cardIds = selectedCards.map((card) => card.id);
		const cmd = new DeleteCardCommand(cardIds);
		await plugin.commandService?.execute(cmd);

		panel.exitSelectionMode();
		notify().cardsDeletedWithUndo(cmd.deletedCount, () => {
			void plugin.commandService?.undo();
		});
	}, [flashcardInfo, currentFile, selectedCardIds, plugin, panel, app]);

	const handleChangeNoteType = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { ChangeNoteTypeModal } = await import(
			"@true-recall/obsidian/modals/library/ChangeNoteTypeModal"
		);
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);

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

		for (const info of noteInfos) {
			const cmd = new ChangeNoteTypeCommand(
				info.noteId,
				result.targetNoteTypeId,
				result.fieldMapping,
			);
			await plugin.commandService?.execute(cmd);
		}

		notify().success(`${noteInfos.length} note(s) changed`);
		panel.exitSelectionMode();
	}, [flashcardInfo, selectedCardIds, app, plugin, panel]);

	const handleSuspendSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);

		const cardIds = Array.from(selectedCardIds);
		const cmd = new SuspendCommand(cardIds);
		await plugin.commandService?.execute(cmd);
		panel.exitSelectionMode();
		notify().success(`Suspended ${cardIds.length} card(s)`);
	}, [flashcardInfo, selectedCardIds, plugin, panel]);

	const handleUnsuspendSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);

		const cardIds = Array.from(selectedCardIds);
		const cmd = new UnsuspendCommand(cardIds);
		await plugin.commandService?.execute(cmd);
		panel.exitSelectionMode();
		notify().success(`Unsuspended ${cardIds.length} card(s)`);
	}, [flashcardInfo, selectedCardIds, plugin, panel]);

	const handlePolishSelected = useCallback(
		async (workflow: AIWorkflow) => {
			if (selectedCardIds.size === 0) return;
			const { notify } = await import(
				"@true-recall/obsidian/services/notification.service"
			);

			const { confirm } = await import(
				"@true-recall/obsidian/modals/shared/ConfirmModal"
			);

			const selectedCards = cardsWithFsrs.filter((card) =>
				selectedCardIds.has(card.id),
			);
			if (selectedCards.length === 0) return;

			// Each card is a separate paid AI request, so the batch is confirmed
			// the same way a bulk delete is.
			const confirmed = await confirm(app, {
				message: `Run "${workflow.name}" on ${selectedCards.length} selected card(s)? Each card is a separate AI request.`,
			});
			if (!confirmed) return;

			for (const card of selectedCards) {
				startCardPolish(plugin, workflow, card);
			}
			panel.exitSelectionMode();
			notify().info(
				`Polishing ${selectedCards.length} card(s) with ${workflow.name}…`,
			);
		},
		[app, selectedCardIds, cardsWithFsrs, plugin, panel],
	);

	const handleForgetSelected = useCallback(async () => {
		if (!flashcardInfo || selectedCardIds.size === 0) return;
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);

		const cardIds = Array.from(selectedCardIds).filter(
			(cardId) => plugin.cardStore.get(cardId)?.state !== State.New,
		);
		if (cardIds.length === 0) {
			notify().warning("Forget is only available for non-New cards");
			return;
		}
		const cmd = new ForgetCommand(cardIds);
		await plugin.commandService?.execute(cmd);
		panel.exitSelectionMode();
		notify().cardsForgotten(cardIds.length);
	}, [flashcardInfo, selectedCardIds, plugin, panel]);

	return {
		handleToggleSelect,
		handleSetCardsSelected,
		handleEnterSelectionMode,
		handleExitSelectionMode,
		handleSelectCards,
		handleSelectAll,
		handleMoveSelected,
		handleChangeNoteType,
		handleSuspendSelected,
		handleUnsuspendSelected,
		handleForgetSelected,
		handleDeleteSelected,
		handlePolishSelected,
	};
}
