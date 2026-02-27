import {
	getSourceNoteNameFromFile,
	notifyDuplicateError,
} from "@features/library/ui/panel/utils/panel-helpers";
import type { PanelApi } from "@shared/store";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
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
	panel,
	preserveScroll,
	captureScroll,
}: UseCardActionsParams) {
	const plugin = usePlugin();
	const app = useApp();

	// ── Shared edit modal logic (used by both single-edit and group-edit) ──

	const openEditModal = useCallback(
		async (card: FlashcardItem, restoreScroll: () => void) => {
			if (!currentFile) return;
			const { SimpleFlashcardEditorModal } = await import(
				"@shared/ui/modals/SimpleFlashcardEditorModal"
			);
			const { cardToMarkdown } = await import(
				"@features/study/services/flashcard/flashcard-format.util"
			);
			const { notify } = await import("@shared/services/notification.service");
			const { DuplicateQuestionError } = await import(
				"@features/study/services/flashcard/card-repository.service"
			);

			const modal = new SimpleFlashcardEditorModal(
				app,
				{
					mode: "edit",
					currentFilePath: currentFile.path,
					prefillContent: cardToMarkdown(card),
					editCardId: card.id,
				},
				plugin.EmbeddableEditor,
			);

			const result = await modal.openAndWait();
			if (result.cancelled || result.flashcards.length === 0) return;

			try {
				const firstFlashcard = result.flashcards[0];
				if (firstFlashcard) {
					plugin.flashcardManager.updateCardContent(
						card.id,
						firstFlashcard.question,
						firstFlashcard.answer,
					);
				}

				if (result.flashcards.length > 1) {
					const frontmatterService =
						plugin.flashcardManager.getFrontmatterService();
					let sourceUid =
						await frontmatterService.getSourceNoteUid(currentFile);
					if (!sourceUid) {
						sourceUid = frontmatterService.generateUid();
						await frontmatterService.setSourceNoteUid(
							currentFile,
							sourceUid,
						);
					}

					for (let i = 1; i < result.flashcards.length; i++) {
						const flashcard = result.flashcards[i];
						if (flashcard) {
							await plugin.flashcardManager.addSingleFlashcard(
								flashcard.question,
								flashcard.answer,
								sourceUid,
							);
						}
					}
					notify().success(
						`Updated card and created ${result.flashcards.length - 1} new cards`,
					);
				} else {
					notify().cardUpdated();
				}

				restoreScroll();
			} catch (error) {
				if (error instanceof DuplicateQuestionError) {
					const question = result.flashcards[0]?.question ?? "";
					notifyDuplicateError(plugin, error, question);
				} else {
					notify().operationFailed("update flashcard", error);
				}
			}
		},
		[currentFile, app, plugin],
	);

	// ── Single card handlers ──

	const handleAddFlashcard = useCallback(
		async (
			prefillFlashcards?: Array<{ question: string; answer: string }>,
		) => {
			const { SimpleFlashcardEditorModal } = await import(
				"@shared/ui/modals/SimpleFlashcardEditorModal"
			);
			const { cardsToMarkdown } = await import(
				"@features/study/services/flashcard/flashcard-format.util"
			);

			const modal = new SimpleFlashcardEditorModal(
				app,
				{
					mode: "add",
					currentFilePath: currentFile?.path ?? "",
					prefillContent: prefillFlashcards
						? cardsToMarkdown(prefillFlashcards)
						: undefined,
				},
				plugin.EmbeddableEditor,
				plugin.flashcardManager,
			);

			await modal.openAndWait();
		},
		[currentFile, app, plugin],
	);

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
			const { notify } = await import(
				"@shared/services/notification.service"
			);
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
		const { notify } = await import("@shared/services/notification.service");
		const text = `Q: ${card.question}\nA: ${card.answer}`;
		await navigator.clipboard.writeText(text);
		notify().success("Copied to clipboard");
	}, []);

	const handleMoveCard = useCallback(
		async (card: FlashcardItem) => {
			if (!flashcardInfo) return;
			if (!card.id) {
				(await import("@shared/services/notification.service"))
					.notify()
					.error(
						"Cannot move card without UUID. Please regenerate flashcards.",
					);
				return;
			}
			const { MoveCardModal } = await import(
				"@shared/ui/modals/MoveCardModal"
			);
			const { notify } = await import(
				"@shared/services/notification.service"
			);

			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				currentFile,
				flashcardInfo,
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

	// ── Group handlers ──

	const handleEditGroup = useCallback(
		async (cards: FlashcardItem[], clozeTemplate?: string) => {
			if (!currentFile) return;

			// Non-cloze groups: delegate to shared edit modal
			if (!clozeTemplate) {
				const originalCard = cards[0];
				if (!originalCard) return;
				const restoreScroll = captureScroll();
				await openEditModal(originalCard, restoreScroll);
				return;
			}

			const { SimpleFlashcardEditorModal } = await import(
				"@shared/ui/modals/SimpleFlashcardEditorModal"
			);
			const { cardToMarkdown } = await import(
				"@features/study/services/flashcard/flashcard-format.util"
			);
			const { notify } = await import(
				"@shared/services/notification.service"
			);

			const restoreScroll = captureScroll();

			const modal = new SimpleFlashcardEditorModal(
				app,
				{
					mode: "edit",
					currentFilePath: currentFile.path,
					prefillContent: cards[0] ? cardToMarkdown(cards[0]) : "",
					editCardId: cards[0]?.id,
				},
				plugin.EmbeddableEditor,
			);

			const result = await modal.openAndWait();
			if (result.cancelled || result.flashcards.length === 0) return;

			try {
				const firstFlashcard = result.flashcards[0];
				if (!firstFlashcard) return;

				const frontmatterService =
					plugin.flashcardManager.getFrontmatterService();
				const sourceUid =
					await frontmatterService.getSourceNoteUid(currentFile);
				if (!sourceUid) return;

				const { hasClozeContent } = await import(
					"@features/study/services/flashcard/cloze-parser.service"
				);
				if (hasClozeContent(firstFlashcard.question)) {
					plugin.flashcardManager.updateClozeTemplate(
						sourceUid,
						clozeTemplate,
						firstFlashcard.question,
						currentFile.basename,
					);
					notify().success("Updated cloze group");
				} else {
					const cardId = cards[0]?.id;
					if (cardId) {
						plugin.flashcardManager.updateCardContent(
							cardId,
							firstFlashcard.question,
							firstFlashcard.answer,
						);
						notify().cardUpdated();
					}
				}

				restoreScroll();
			} catch (error) {
				notify().operationFailed("update cloze group", error);
			}
		},
		[currentFile, app, plugin, openEditModal, captureScroll],
	);

	const handleDeleteGroup = useCallback(
		async (cards: FlashcardItem[]) => {
			if (cards.length === 0) return;
			const cardId = cards[0]?.id;
			if (!cardId) return;
			const { notify } = await import(
				"@shared/services/notification.service"
			);
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
		const { notify } = await import("@shared/services/notification.service");
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
			const { MoveCardModal } = await import(
				"@shared/ui/modals/MoveCardModal"
			);
			const { notify } = await import(
				"@shared/services/notification.service"
			);

			const firstCard = cards[0];
			if (!firstCard) return;
			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				currentFile,
				flashcardInfo,
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
