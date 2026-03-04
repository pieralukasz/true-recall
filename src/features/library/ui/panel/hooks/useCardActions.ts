import { QuickNoteEditorModal } from "@features/study/modals/quick-note-editor/QuickNoteEditorModal";
import {
	getSourceNoteNameFromFile,
	notifyDuplicateError,
} from "@features/library/ui/panel/utils/panel-helpers";
import type { PanelApi } from "@shared/store";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { notify } from "@shared/services/notification.service";
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

			const modal = new QuickNoteEditorModal(app, plugin, {
				mode: "edit",
				cardId: card.id,
				noteId: note.id,
				note,
				noteType,
			});

			await modal.openAndWait();
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

			const { MoveCardModal } = await import(
				"@shared/ui/modals/MoveCardModal"
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
				await plugin.flashcardManager.moveCard(
					card.id,
					result.targetNotePath,
				);
				notify().cardsMoved(1, result.targetNotePath);
			} catch (error) {
				notify().operationFailed("move card", error);
			}
		},
		[currentFile, flashcardInfo, app, plugin],
	);

	const handleToggleExpand = useCallback(
		(cardId: string) => {
			preserveScroll(() => {
				panel.toggleCardExpanded(cardId);
			});
		},
		[panel, preserveScroll],
	);

	const handleEditGroup = useCallback(
		async (cards: FlashcardItem[], clozeTemplate?: string) => {
			if (!currentFile) return;

			const firstCard = cards[0];
			if (!firstCard) return;

			const restoreScroll = captureScroll();

			const fsrsCard = findFsrsCard(firstCard.id);
			if (!fsrsCard?.noteId) {
				notify().error(
					"Cannot edit card: missing note link. Please restart Obsidian to complete database migration.",
				);
				return;
			}

			const note = plugin.cardStore.notes.getById(fsrsCard.noteId);
			if (!note) {
				notify().error("Note not found");
				restoreScroll();
				return;
			}
			const noteType = plugin.cardStore.noteTypes.getById(note.noteTypeId);
			if (!noteType) {
				notify().error("Note type not found");
				restoreScroll();
				return;
			}

			const modal = new QuickNoteEditorModal(app, plugin, {
				mode: "edit",
				cardId: firstCard.id,
				noteId: note.id,
				note,
				noteType,
			});

			await modal.openAndWait();
			restoreScroll();
		},
		[currentFile, app, plugin, cardsWithFsrs, captureScroll],
	);

	const handleDeleteGroup = useCallback(
		async (cards: FlashcardItem[]) => {
			if (cards.length === 0) return;
			const cardId = cards[0]?.id;
			if (!cardId) return;
			const restoreScroll = captureScroll();
			const removed =
				await plugin.flashcardManager.removeFlashcardById(cardId);
			if (removed) {
				notify().cardsDeleted(cards.length);
				restoreScroll();
			} else {
				notify().error("Failed to remove card group");
			}
		},
		[plugin, captureScroll],
	);

	const handleCopyGroup = useCallback(async (cards: FlashcardItem[]) => {
		if (cards.length === 0) return;
		const firstCard = cards[0];
		if (!firstCard) return;
		let text: string;
		if (firstCard.clozeTemplate) {
			text = firstCard.clozeTemplate;
		} else {
			text = cards
				.map((c) => `Q: ${c.question}\nA: ${c.answer}`)
				.join("\n\n");
		}
		await navigator.clipboard.writeText(text);
		notify().success("Copied to clipboard");
	}, []);

	const handleMoveGroup = useCallback(
		async (cards: FlashcardItem[]) => {
			if (cards.length === 0) return;
			const firstCard = cards[0];
			if (!firstCard) return;

			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				currentFile,
				flashcardInfo,
			);

			const { MoveCardModal } = await import(
				"@shared/ui/modals/MoveCardModal"
			);
			const modal = new MoveCardModal(app, {
				cardCount: cards.length,
				sourceNoteName,
				cardQuestion: firstCard.question,
				cardAnswer: firstCard.answer,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNotePath) return;

			const targetPath = result.targetNotePath;
			const results = await Promise.allSettled(
				cards.map((card) =>
					plugin.flashcardManager.moveCard(card.id, targetPath),
				),
			);

			const successCount = results.filter(
				(r) => r.status === "fulfilled",
			).length;
			notify().success(
				`Moved ${successCount} of ${cards.length} cards`,
			);
		},
		[currentFile, flashcardInfo, app, plugin],
	);

	return {
		handleAddFlashcard,
		handleEditButton,
		handleDeleteCard,
		handleCopyCard,
		handleMoveCard,
		handleToggleExpand,
		handleEditGroup,
		handleDeleteGroup,
		handleCopyGroup,
		handleMoveGroup,
	};
}
