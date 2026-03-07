import { openPanelCardEditor } from "@features/library/ui/panel/helpers/panel-edit-routing";
import { getSourceNoteNameFromFile } from "@features/library/ui/panel/utils/panel-helpers";
import { QuickNoteEditorModal } from "@features/study/modals/quick-note-editor/QuickNoteEditorModal";
import { notify } from "@shared/services/notification.service";
import { notifyCardChange } from "@shared/services/signals";
import type { PanelApi } from "@shared/store";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_BASIC_REVERSED_ID,
	type FlashcardInfo,
	type FlashcardItem,
} from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { useApp, usePlugin } from "@shared/ui/preact";
import type { TFile } from "obsidian";
import { useCallback } from "preact/hooks";

export interface UseCardActionsParams {
	currentFile: TFile | null;
	flashcardInfo: FlashcardInfo | null;
	cardsWithFsrs: FSRSFlashcardItem[];
	panel: PanelApi;
	preserveScroll: (action: () => void) => void;
	captureScroll: () => () => void;
}

export function useCardActions({
	currentFile,
	flashcardInfo,
	cardsWithFsrs,
	panel,
	preserveScroll,
	captureScroll,
}: UseCardActionsParams) {
	const plugin = usePlugin();
	const app = useApp();

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
			const removed = await plugin.flashcardManager.removeFlashcardById(
				card.id,
			);
			if (removed) {
				notify().cardsDeleted(1);
				restoreScroll();
			} else {
				notify().error("Failed to remove flashcard from file");
			}
		},
		[currentFile, plugin, captureScroll],
	);

	const handleCopyCard = useCallback(async (card: FlashcardItem) => {
		const text = `Q: ${card.question}\nA: ${card.answer}`;
		await navigator.clipboard.writeText(text);
		notify().success("Copied to clipboard");
	}, []);

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

			const { MoveCardModal } = await import("@shared/ui/modals/MoveCardModal");
			const modal = new MoveCardModal(app, {
				cardCount: 1,
				sourceNoteName,
				cardQuestion: card.question,
				cardAnswer: card.answer,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNotePath) return;

			try {
				await plugin.flashcardManager.moveCard(card.id, result.targetNotePath);
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
				"@features/library/modals/ChangeNoteTypeModal"
			);
			const { notifyCardChange } = await import("@shared/services/signals");

			const allNoteTypes = plugin.cardStore.noteTypes.getAll();

			const modal = new ChangeNoteTypeModal(app, {
				currentNoteType,
				availableNoteTypes: allNoteTypes,
				noteCount: 1,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
				return;

			const r = plugin.flashcardManager.changeNoteType(
				fsrsCard.noteId,
				result.targetNoteTypeId,
				result.fieldMapping,
			);

			const parts: string[] = ["Note type changed"];
			if (r.createdCardIds.length > 0)
				parts.push(`${r.createdCardIds.length} cards created`);
			if (r.deletedCardIds.length > 0)
				parts.push(`${r.deletedCardIds.length} cards removed`);
			notifyCardChange({
				type: "bulk",
				cardIds: [card.id, ...r.createdCardIds, ...r.deletedCardIds],
				action: "update",
			});
			notify().success(parts.join(", "));
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

			const { notifyCardChange } = await import("@shared/services/signals");
			const fieldMapping = { Front: "Front", Back: "Back" };
			const r = plugin.flashcardManager.changeNoteType(
				fsrsCard.noteId,
				targetNoteTypeId,
				fieldMapping,
			);

			notifyCardChange({
				type: "bulk",
				cardIds: [card.id, ...r.createdCardIds, ...r.deletedCardIds],
				action: "update",
			});

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
			plugin.cardStore.cards.bulkForget([card.id]);
			notifyCardChange({ type: "bulk", cardIds: [card.id], action: "reset" });
			notify().cardForgotten();
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

	return {
		handleAddFlashcard,
		handleEditButton,
		handleDeleteCard,
		handleCopyCard,
		handleMoveCard,
		handleChangeType,
		handleToggleReversed,
		handleForgetCard,
		handleToggleExpand,
	};
}
