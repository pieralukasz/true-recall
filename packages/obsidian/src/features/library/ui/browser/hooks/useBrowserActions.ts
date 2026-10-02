import { type Signal, useSignal } from "@preact/signals";
import { useCallback, useEffect, useMemo } from "preact/hooks";

import { DuplicateQuestionError } from "@true-recall/core/flashcard/data/card-repository.service";
import type { CardBrowserQueryService } from "@true-recall/core/services/browser/card-browser-query.service";

import { MoveCardModal } from "@true-recall/obsidian/modals/shared/MoveCardModal";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";

import { notifyDuplicateError } from "../../panel/utils/panel-helpers";
import {
	openCardEditor,
	resolveCardEditTarget,
} from "../../shared/card-edit-routing";
import {
	type BrowserActionDeps,
	type CardField,
	editCard,
	moveCard,
	moveCards,
	reconcilePreviewCard,
	removeOrphanedCards,
	saveCardContent,
} from "../helpers/browser-actions";
import type { BrowserCard, BrowserResult } from "../types";
import type { BrowserSelection } from "./useBrowserSelection";

interface BrowserActionsOptions {
	queryService: CardBrowserQueryService;
	selection: BrowserSelection;
	/** Current query result; a new object means the data may have changed. */
	result: BrowserResult;
}

/**
 * Card actions of the browser (inline edit, full edit, move, bulk move,
 * orphan cleanup) plus the preview they act on. Workflows live in
 * `browser-actions.ts`; this hook binds them to the plugin, keeps the preview
 * and the selection consistent with the outcome, and never reports a
 * cancelled or failed operation as done.
 */
export function useBrowserActions({
	queryService,
	selection,
	result,
}: BrowserActionsOptions) {
	const app = useApp();
	const plugin = usePlugin();
	const previewCard: Signal<BrowserCard | null> = useSignal(null);

	const deps = useMemo(
		(): BrowserActionDeps => ({
			updateCardContent: (cardId, question, answer) =>
				plugin.flashcardManager.updateCardContent(cardId, question, answer),
			executeCommand: async (command) => {
				await plugin.commandService?.execute(command);
			},
			undo: () => {
				void plugin.commandService?.undo();
			},
			getBrowserCard: (cardId) => queryService.getBrowserCard(cardId),
			getOrphanedCardIds: () => queryService.getOrphanedCardIds(),
			confirm: async (message) => {
				const { confirm } = await import(
					"@true-recall/obsidian/modals/shared/ConfirmModal"
				);
				return confirm(app, { message });
			},
			pickMoveTarget: async (request) => {
				const modal = new MoveCardModal(app, request);
				const picked = await modal.openAndWait();
				return picked.cancelled ? null : picked.targetNotePath;
			},
			resolveEditTarget: (cardId) =>
				resolveCardEditTarget(cardId, {
					getNoteInfoForCardIds: (ids) =>
						plugin.cardStore.cards.getNoteInfoForCardIds(ids),
					getNoteById: (noteId) => plugin.cardStore.notes.getById(noteId),
					getNoteTypeById: (noteTypeId) =>
						plugin.cardStore.noteTypes.getById(noteTypeId),
				}),
			openEditor: (cardId, note, noteType) =>
				openCardEditor({
					note,
					noteType,
					openImageOcclusionEditor: (mode) =>
						plugin.openImageOcclusionEditor(mode),
					openQuickEditor: () =>
						openQuickNoteEditor(plugin, {
							mode: "edit",
							cardId,
							noteId: note.id,
							note,
							noteType,
						}),
					commandService: plugin.commandService,
				}),
			notify: {
				warning: (message) => notify().warning(message),
				error: (message) => notify().error(message),
				operationFailed: (operation, error) =>
					notify().operationFailed(operation, error),
				duplicateQuestion: (error, question) => {
					if (!(error instanceof DuplicateQuestionError)) return false;
					notifyDuplicateError(plugin, error, question);
					return true;
				},
				cardsMoved: (count, target) => notify().cardsMoved(count, target),
				cardsDeletedWithUndo: (count, onUndo) =>
					notify().cardsDeletedWithUndo(count, onUndo),
			},
		}),
		[app, plugin, queryService],
	);

	// Undo, bulk actions and edits elsewhere change the stored card behind the
	// preview; keep it in sync, and close it once the card is gone.
	useEffect(() => {
		const current = previewCard.peek();
		if (!current) return;
		const next = reconcilePreviewCard(
			current,
			queryService.getBrowserCard(current.id),
		);
		if (next !== current) previewCard.value = next;
	}, [result, queryService, previewCard]);

	const togglePreview = useCallback(
		(card: BrowserCard) => {
			previewCard.value = previewCard.value?.id === card.id ? null : card;
		},
		[previewCard],
	);

	const closePreview = useCallback(() => {
		previewCard.value = null;
	}, [previewCard]);

	/** Apply an async result only if the same card is still previewed. */
	const updatePreviewIfCurrent = useCallback(
		(cardId: string, next: BrowserCard | null) => {
			if (previewCard.peek()?.id === cardId) previewCard.value = next;
		},
		[previewCard],
	);

	const saveContent = useCallback(
		async (value: string, field: CardField) => {
			const card = previewCard.peek();
			if (!card) return;
			const saved = await saveCardContent(deps, card, value, field);
			if (saved) updatePreviewIfCurrent(card.id, saved);
		},
		[deps, previewCard, updatePreviewIfCurrent],
	);

	const editPreviewCard = useCallback(async () => {
		const card = previewCard.peek();
		if (!card) return;
		const next = await editCard(deps, card);
		updatePreviewIfCurrent(card.id, next);
	}, [deps, previewCard, updatePreviewIfCurrent]);

	const movePreviewCard = useCallback(async () => {
		const card = previewCard.peek();
		if (!card) return;
		if (!(await moveCard(deps, card))) return;
		updatePreviewIfCurrent(card.id, queryService.getBrowserCard(card.id));
	}, [deps, previewCard, queryService, updatePreviewIfCurrent]);

	const { selectedIds, clear: clearSelection, remove: deselect } = selection;

	const moveSelected = useCallback(async () => {
		if (await moveCards(deps, Array.from(selectedIds))) clearSelection();
	}, [deps, selectedIds, clearSelection]);

	const removeOrphaned = useCallback(async () => {
		const removed = await removeOrphanedCards(deps);
		if (removed.length === 0) return;
		deselect(removed);
		const card = previewCard.peek();
		if (card && removed.includes(card.id)) previewCard.value = null;
	}, [deps, previewCard, deselect]);

	return {
		previewCard: previewCard.value,
		togglePreview,
		closePreview,
		saveContent,
		editPreviewCard,
		movePreviewCard,
		moveSelected,
		removeOrphaned,
	};
}
