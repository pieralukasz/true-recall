import { useCallback } from "preact/hooks";

import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	type FlashcardItem,
} from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import { ForgetCommand } from "@true-recall/obsidian/commands/commands/card-forget.cmd";
import { MoveCardCommand } from "@true-recall/obsidian/commands/commands/card-move.cmd";
import {
	SuspendCommand,
	UnsuspendCommand,
} from "@true-recall/obsidian/commands/commands/card-suspend.cmd";
import {
	ChangeNoteTypeCommand,
	ToggleReversedCommand,
} from "@true-recall/obsidian/commands/commands/note-type.cmd";
import { openPanelCardEditor } from "@true-recall/obsidian/features/library/ui/panel/helpers/panel-edit-routing";
import { openCardPreviewModal } from "@true-recall/obsidian/features/library/ui/panel/preview/CardPreviewModal";
import {
	cardToBlockText,
	getSourceNoteNameFromFile,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { usePanelScroll } from "./PanelScrollContext";
import { usePanelStore } from "./usePanelStore";

export function useCardActions() {
	const { preserveScroll, captureScroll } = usePanelScroll();
	const plugin = usePlugin();
	const app = useApp();
	const { currentFile, flashcardInfo, cardsWithFsrs, panel } = usePanelStore();

	const findFsrsCard = (cardId: string): FSRSFlashcardItem | undefined => {
		return cardsWithFsrs.find((c) => c.id === cardId);
	};

	const openEditModal = useCallback(
		async (card: FlashcardItem, restoreScroll: () => void) => {
			const fsrsCard = findFsrsCard(card.id);
			if (!fsrsCard?.noteId) {
				notify().error(
					"Cannot edit card: missing note link. Please restart Obsidian to complete database migration.",
				);
				return;
			}

			const note = plugin.cardStore.notes.getById(fsrsCard.noteId);
			if (!note) {
				notify().error("Note not found");
				return;
			}
			const noteType = plugin.cardStore.noteTypes.getById(note.noteTypeId);
			if (!noteType) {
				notify().error("Note type not found");
				return;
			}

			await openPanelCardEditor({
				note,
				noteType,
				openImageOcclusionEditor: (mode) =>
					plugin.openImageOcclusionEditor(mode),
				openQuickEditor: async () => {
					const modal = new QuickNoteEditorModal(app, plugin, {
						mode: "edit",
						cardId: card.id,
						noteId: note.id,
						note,
						noteType,
					});
					await modal.openAndWait();
				},
			});
			restoreScroll();
		},
		[app, plugin, cardsWithFsrs],
	);

	const handleAddFlashcard = useCallback(async () => {
		const sourceUid = flashcardInfo?.sourceUid;
		const modal = new QuickNoteEditorModal(app, plugin, {
			mode: "add",
			sourceUid,
		});
		await modal.openAndWait();
	}, [app, plugin, flashcardInfo]);

	const handleEditButton = useCallback(
		async (card: FlashcardItem) => {
			const restoreScroll = captureScroll();
			await openEditModal(card, restoreScroll);
		},
		[openEditModal, captureScroll],
	);

	const handleDeleteCard = useCallback(
		async (card: FlashcardItem) => {
			if (!currentFile) return;
			const restoreScroll = captureScroll();
			const cmd = new DeleteCardCommand([card.id]);
			await plugin.commandService?.execute(cmd);
			if (cmd.deletedCount > 0) {
				notify().cardsDeletedWithUndo(cmd.deletedCount, () => {
					void plugin.commandService?.undo();
				});
				restoreScroll();
			} else {
				notify().error("Failed to remove flashcard from file");
			}
		},
		[currentFile, plugin, captureScroll],
	);

	const handleCopyCard = useCallback(
		async (card: FlashcardItem) => {
			const text = cardToBlockText(card, plugin);
			await navigator.clipboard.writeText(text);
			notify().success("Copied to clipboard");
		},
		[plugin],
	);

	const handleMoveCard = useCallback(
		async (card: FlashcardItem) => {
			if (!flashcardInfo) return;
			if (!card.id) {
				notify().error(
					"Cannot move card without UUID. Please regenerate flashcards.",
				);
				return;
			}

			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				currentFile,
				flashcardInfo,
			);

			const { MoveCardModal } = await import(
				"@true-recall/obsidian/modals/shared/MoveCardModal"
			);
			const modal = new MoveCardModal(app, {
				cardCount: 1,
				sourceNoteName,
				cardQuestion: card.question,
				cardAnswer: card.answer,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNotePath) return;

			try {
				const cmd = new MoveCardCommand(card.id, result.targetNotePath);
				await plugin.commandService?.execute(cmd);
				notify().cardsMoved(1, result.targetNotePath);
			} catch (error) {
				notify().operationFailed("move card", error);
			}
		},
		[currentFile, flashcardInfo, app, plugin],
	);

	const handleChangeType = useCallback(
		async (card: FlashcardItem) => {
			const fsrsCard = findFsrsCard(card.id);
			if (!fsrsCard?.noteId) {
				notify().error("Cannot change type: missing note link.");
				return;
			}

			const note = plugin.cardStore.notes.getById(fsrsCard.noteId);
			if (!note) {
				notify().error("Note not found");
				return;
			}

			const currentNoteType = plugin.cardStore.noteTypes.getById(
				note.noteTypeId,
			);
			if (!currentNoteType) {
				notify().error("Note type not found");
				return;
			}

			const { ChangeNoteTypeModal } = await import(
				"@true-recall/obsidian/modals/library/ChangeNoteTypeModal"
			);

			const allNoteTypes = plugin.cardStore.noteTypes.getAll();

			const modal = new ChangeNoteTypeModal(app, {
				currentNoteType,
				availableNoteTypes: allNoteTypes,
				noteCount: 1,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
				return;

			const cmd = new ChangeNoteTypeCommand(
				fsrsCard.noteId,
				result.targetNoteTypeId,
				result.fieldMapping,
			);
			await plugin.commandService?.execute(cmd);
			notify().success("Note type changed");
		},
		[app, plugin, cardsWithFsrs],
	);

	const handleToggleReversed = useCallback(
		async (card: FlashcardItem) => {
			const fsrsCard = findFsrsCard(card.id);
			if (!fsrsCard?.noteId) {
				notify().error("Cannot toggle reversed: missing note link.");
				return;
			}

			const note = plugin.cardStore.notes.getById(fsrsCard.noteId);
			if (!note) {
				notify().error("Note not found");
				return;
			}

			const { noteTypeId } = note;
			let targetNoteTypeId: string;
			if (noteTypeId === BUILTIN_BASIC_ID) {
				targetNoteTypeId = BUILTIN_BASIC_REVERSED_ID;
			} else if (noteTypeId === BUILTIN_BASIC_REVERSED_ID) {
				targetNoteTypeId = BUILTIN_BASIC_ID;
			} else {
				notify().warning("Reversed is only available for basic cards");
				return;
			}

			const fieldMapping = { Front: "Front", Back: "Back" };
			const cmd = new ToggleReversedCommand(
				fsrsCard.noteId,
				targetNoteTypeId,
				fieldMapping,
			);
			await plugin.commandService?.execute(cmd);

			if (targetNoteTypeId === BUILTIN_BASIC_REVERSED_ID) {
				notify().success("Reversed card created");
			} else {
				notify().success("Reversed card removed");
			}
		},
		[plugin, cardsWithFsrs],
	);

	const handleForgetCard = useCallback(
		(card: FlashcardItem) => {
			const data = plugin.cardStore.get(card.id);
			if (!data || data.state === 0) {
				notify().warning("Forget is only available for non-New cards");
				return;
			}
			const cmd = new ForgetCommand([card.id]);
			void plugin.commandService?.execute(cmd);
			notify().cardForgotten();
		},
		[plugin],
	);

	const handleSuspendCard = useCallback(
		(card: FlashcardItem) => {
			const cmd = new SuspendCommand([card.id]);
			void plugin.commandService?.execute(cmd);
			notify().success("Card suspended");
		},
		[plugin],
	);

	const handleUnsuspendCard = useCallback(
		(card: FlashcardItem) => {
			const cmd = new UnsuspendCommand([card.id]);
			void plugin.commandService?.execute(cmd);
			notify().success("Card unsuspended");
		},
		[plugin],
	);

	const handleToggleExpand = useCallback(
		(cardId: string) => {
			preserveScroll(() => {
				panel.toggleCardExpanded(cardId);
			});
		},
		[panel, preserveScroll],
	);

	const handlePreviewCard = useCallback(
		(card: FlashcardItem) => {
			const fsrsCard = findFsrsCard(card.id);
			if (!fsrsCard) return;
			openCardPreviewModal(app, plugin, fsrsCard, currentFile?.path ?? "");
		},
		[app, plugin, cardsWithFsrs, currentFile],
	);

	return {
		handleAddFlashcard,
		handleEditButton,
		handleDeleteCard,
		handleCopyCard,
		handleMoveCard,
		handleChangeType,
		handleToggleReversed,
		handleForgetCard,
		handleSuspendCard,
		handleUnsuspendCard,
		handleToggleExpand,
		handlePreviewCard,
	};
}
