import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { ReviewService } from "@true-recall/core/services/review/review.service";
import type {
	FSRSFlashcardItem,
	TrueRecallSettings,
} from "@true-recall/core/types";
import type { FSRSCardData } from "@true-recall/core/types/fsrs/card.types";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@true-recall/core/types/note.types";
import { mutate } from "@true-recall/obsidian/data";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { MoveCardModal } from "@true-recall/obsidian/modals/shared";
import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";
import type { App } from "obsidian";
import { Rating, State } from "ts-fsrs";

const FORGET_NON_NEW_WARNING =
	"Forget is only available for cards that are not New.";

export interface CardActionsHandlerDeps {
	app: App;
	getReview: () => ReviewApi;
	flashcardManager: FlashcardManager;
	fsrsService: FSRSService;
	reviewService: ReviewService;
	cardStore: SqliteStoreService;
	settings: TrueRecallSettings;
	plugin: TrueRecallPlugin;
}

export interface CardActionsCallbacks {
	onUpdateSchedulingPreview: () => void;
}

export class CardActionsHandler {
	private deps: CardActionsHandlerDeps;
	private callbacks: CardActionsCallbacks;

	constructor(deps: CardActionsHandlerDeps, callbacks: CardActionsCallbacks) {
		this.deps = deps;
		this.callbacks = callbacks;
	}

	canUndo(): boolean {
		return this.deps.plugin.undoService?.canUndo() ?? false;
	}

	canForgetCurrentCard(): boolean {
		const card = this.deps.getReview().getCurrentCard();
		return !!card && card.fsrs.state !== State.New;
	}

	handleSuspend(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const siblingIds = this.getGroupSiblingIds(card);

		this.deferCardWrite({
			undoType: "suspend",
			description:
				siblingIds.length > 1
					? `Suspend ${siblingIds.length} cards`
					: "Suspend card",
			card,
			siblingIds,
			execute: () => {
				for (const id of siblingIds) {
					const data = this.deps.cardStore.get(id);
					if (data) {
						this.deps.flashcardManager.updateCardFSRS(id, {
							...data,
							suspended: true,
						});
					}
				}
			},
		});

		notify().cardSuspended();
	}

	handleBuryCard(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const buriedUntil = this.getTomorrowDate().toISOString();
		const siblingIds = this.getGroupSiblingIds(card);

		this.deferCardWrite({
			undoType: "bury",
			description:
				siblingIds.length > 1 ? `Bury ${siblingIds.length} cards` : "Bury card",
			card,
			siblingIds,
			execute: () => {
				for (const id of siblingIds) {
					const data = this.deps.cardStore.get(id);
					if (data) {
						this.deps.flashcardManager.updateCardFSRS(id, {
							...data,
							buriedUntil,
						});
					}
				}
			},
		});

		notify().cardBuried();
	}

	handleForget(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;
		if (card.fsrs.state === State.New) {
			notify().warning(FORGET_NON_NEW_WARNING);
			return;
		}

		const siblingIds = this.getGroupSiblingIds(card);
		const forgettableIds = siblingIds.filter((id) => {
			if (id === card.id) return card.fsrs.state !== State.New;
			const sibling = this.deps.cardStore.get(id);
			return !!sibling && sibling.state !== State.New;
		});
		if (forgettableIds.length === 0) {
			notify().warning(FORGET_NON_NEW_WARNING);
			return;
		}

		this.deferCardWrite({
			undoType: "forget",
			description:
				forgettableIds.length > 1
					? `Forget ${forgettableIds.length} cards`
					: "Forget card",
			card,
			siblingIds: forgettableIds,
			execute: () => {
				this.deps.cardStore.cards.bulkForget(forgettableIds);
				this.deps.plugin.sessionPersistence?.removeReviewedCards(
					forgettableIds,
				);
				mutate("cards:bulk", () => {});
			},
		});

		if (forgettableIds.length === 1) {
			notify().cardForgotten();
		} else {
			notify().cardsForgotten(forgettableIds.length);
		}
	}

	handleBuryNote(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const sourceNoteName = card.sourceNoteName;
		if (!sourceNoteName) {
			this.handleBuryCard();
			return;
		}

		const queue = this.deps.getReview().queue;
		const siblingCards = queue.filter(
			(c) => c.sourceNoteName === sourceNoteName,
		);

		const firstSibling = siblingCards[0];
		if (siblingCards.length === 0 || !firstSibling) {
			this.handleBuryCard();
			return;
		}

		const currentIndex = this.deps.getReview().currentIndex;
		const undoService = this.deps.plugin.undoService;
		const buriedUntil = this.getTomorrowDate().toISOString();

		const additionalCards = siblingCards.slice(1).map((c) => ({
			card: { ...c },
			originalFsrs: { ...c.fsrs },
		}));

		let buriedCount = 0;
		for (const siblingCard of siblingCards) {
			try {
				this.deps.flashcardManager.updateCardFSRS(siblingCard.id, {
					...siblingCard.fsrs,
					buriedUntil,
				});
				buriedCount++;
			} catch (error) {
				console.error(
					`[CardActionsHandler] Error burying card ${siblingCard.id}:`,
					error,
				);
			}
			this.deps.getReview().removeCardById(siblingCard.id);
		}

		if (buriedCount > 0) {
			undoService?.push({
				id: crypto.randomUUID(),
				actionType: "bury",
				description: `Bury ${buriedCount} cards`,
				timestamp: Date.now(),
				payload: {
					type: "bury",
					card: { ...firstSibling },
					originalFsrs: { ...firstSibling.fsrs },
					previousIndex: currentIndex,
					additionalCards:
						additionalCards.length > 0 ? additionalCards : undefined,
				},
			});
		}

		this.refreshIfActive();
		notify().cardsBuried(buriedCount);
	}

	async handleMoveCard(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const modal = new MoveCardModal(this.deps.app, {
			cardCount: 1,
			sourceNoteName: card.sourceNoteName,
			cardQuestion: card.question,
			cardAnswer: card.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		try {
			const { persisted } = await this.deps.reviewService.gradeCard(
				card,
				Rating.Good,
				this.deps.fsrsService,
				this.deps.flashcardManager,
			);
			if (!persisted) {
				this.deps.getReview().removeCardById(card.id);
				this.refreshIfActive();
				notify().warning("Card was deleted before move could be saved.");
				return;
			}

			const success = await this.deps.flashcardManager.moveCard(
				card.id,
				result.targetNotePath,
			);

			if (success) {
				this.deps.getReview().removeCurrentCard();
				this.refreshIfActive();
				notify().cardGradedAndMoved();
			}
		} catch (error) {
			console.error("[CardActionsHandler] Error moving card:", error);
			notify().operationFailed("move card", error);
		}
	}

	async handleAddNewFlashcard(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const modal = new QuickNoteEditorModal(this.deps.app, this.deps.plugin, {
			mode: "add",
			sourceUid: card.sourceUid,
			defaultNoteTypeId:
				card.fsrs.noteTypeId === BUILTIN_IMAGE_OCCLUSION_ID
					? "builtin-basic"
					: (card.fsrs.noteTypeId ?? "builtin-basic"),
		});

		const result = await modal.openAndWait();
		if (!result.cancelled) {
			this.pushBatchCreateUndo(card, result.createdCards);
		}
	}

	async handleAddImageOcclusion(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const result = await this.deps.plugin.openImageOcclusionEditor({
			mode: "add",
			sourceUid: card.sourceUid,
		});
		if (!result.cancelled) {
			this.pushBatchCreateUndo(card, result.createdCards, "image occlusion ");
		}
	}

	async handleEditCardModal(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		if (!card.noteId) {
			notify().error(
				"Cannot edit card: missing note link. Please restart Obsidian to complete database migration.",
			);
			return;
		}

		const note = this.deps.cardStore.notes.getById(card.noteId);
		if (!note) {
			notify().error("Note not found");
			return;
		}
		const noteType = this.deps.cardStore.noteTypes.getById(note.noteTypeId);
		if (!noteType) {
			notify().error("Note type not found");
			return;
		}

		const previousFields = { ...note.fields };

		if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
			const result = await this.deps.plugin.openImageOcclusionEditor({
				mode: "edit",
				noteId: note.id,
				note,
			});
			if (result.cancelled) return;

			this.pushFieldEditUndo(note.id, previousFields, "Edit image occlusion");
			return;
		}

		const modal = new QuickNoteEditorModal(this.deps.app, this.deps.plugin, {
			mode: "edit",
			cardId: card.id,
			noteId: note.id,
			note,
			noteType,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		this.pushFieldEditUndo(note.id, previousFields, "Edit card");

		if (result.updatedCardIds?.includes(card.id)) {
			const [updatedCard] = this.deps.cardStore.cards.getByIds([card.id]);
			if (updatedCard) {
				this.deps
					.getReview()
					.updateCurrentCardContent(
						updatedCard.question ?? card.question,
						updatedCard.answer ?? card.answer ?? "",
					);
			}
		}
	}

	async handleChangeNoteType(): Promise<void> {
		const card = this.deps.getReview().getCurrentCard();
		if (!card?.noteId) return;

		const note = this.deps.cardStore.notes.getById(card.noteId);
		if (!note) {
			notify().error("Note not found");
			return;
		}

		const currentNoteType = this.deps.cardStore.noteTypes.getById(
			note.noteTypeId,
		);
		if (!currentNoteType) {
			notify().error("Note type not found");
			return;
		}

		const { ChangeNoteTypeModal } = await import(
			"@true-recall/obsidian/modals/library/ChangeNoteTypeModal"
		);

		const allNoteTypes = this.deps.cardStore.noteTypes.getAll();
		const modal = new ChangeNoteTypeModal(this.deps.app, {
			currentNoteType,
			availableNoteTypes: allNoteTypes,
			noteCount: 1,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
			return;

		const r = this.deps.flashcardManager.changeNoteType(
			card.noteId,
			result.targetNoteTypeId,
			result.fieldMapping,
		);

		for (const id of r.deletedCardIds) {
			this.deps.getReview().removeCardById(id);
		}
		if (!r.keptCardIds.includes(card.id)) {
			this.deps.getReview().removeCardById(card.id);
		}

		this.refreshIfActive();

		const parts: string[] = ["Note type changed"];
		if (r.createdCardIds.length > 0)
			parts.push(`${r.createdCardIds.length} cards created`);
		if (r.deletedCardIds.length > 0)
			parts.push(`${r.deletedCardIds.length} cards removed`);
		notify().success(parts.join(", "));
	}

	async handleUndo(): Promise<boolean> {
		const undoService = this.deps.plugin.undoService;
		if (!undoService?.canUndo()) {
			notify().nothingToUndo();
			return false;
		}
		return undoService.undo();
	}

	// ── Private helpers ─────────────────────────────────

	private refreshIfActive(): void {
		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}
	}

	// Shared pattern for suspend/bury/forget: push undo with deferred write,
	// remove siblings from queue, refresh preview.
	private deferCardWrite(opts: {
		undoType: "suspend" | "bury" | "forget";
		description: string;
		card: FSRSFlashcardItem;
		siblingIds: string[];
		execute: () => void;
	}): void {
		const currentIndex = this.deps.getReview().currentIndex;
		const undoService = this.deps.plugin.undoService;

		let writeExecuted = false;
		let pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

		undoService?.push({
			id: crypto.randomUUID(),
			actionType: opts.undoType,
			description: opts.description,
			timestamp: Date.now(),
			payload: {
				type: opts.undoType,
				card: { ...opts.card } as FSRSFlashcardItem,
				originalFsrs: { ...opts.card.fsrs } as FSRSCardData,
				previousIndex: currentIndex,
			},
			cancelPendingWrite: () => {
				if (!writeExecuted && pendingTimeoutId !== null) {
					clearTimeout(pendingTimeoutId);
					pendingTimeoutId = null;
					return true;
				}
				return false;
			},
		});

		for (const id of opts.siblingIds) {
			this.deps.getReview().removeCardById(id);
		}

		this.refreshIfActive();

		pendingTimeoutId = setTimeout(() => {
			writeExecuted = true;
			pendingTimeoutId = null;
			try {
				opts.execute();
			} catch (error) {
				console.error(
					`[CardActionsHandler] Error in deferred ${opts.undoType}:`,
					error,
				);
			}
		}, 0);
	}

	private pushBatchCreateUndo(
		card: { sourceNotePath?: string },
		createdCards?: Array<{ id: string }>,
		prefix = "",
	): void {
		const count = createdCards?.length ?? 0;
		if (count === 0) return;

		this.deps.plugin.undoService?.push({
			id: crypto.randomUUID(),
			actionType: "batch-create",
			description: `Add ${count} ${prefix}card${count !== 1 ? "s" : ""}`,
			timestamp: Date.now(),
			payload: {
				type: "batch-create",
				cardIds: createdCards?.map((c) => c.id) ?? [],
			},
		});

		const noteName = card.sourceNotePath
			?.split("/")
			.pop()
			?.replace(/\.md$/, "");
		notify().cardsCreated(count, noteName);
	}

	private pushFieldEditUndo(
		noteId: string,
		previousFields: Record<string, string>,
		description: string,
	): void {
		this.deps.plugin.undoService?.push({
			id: crypto.randomUUID(),
			actionType: "update-note-fields",
			description,
			timestamp: Date.now(),
			payload: {
				type: "update-note-fields",
				noteId,
				previousFields,
			},
		});
	}

	private getGroupSiblingIds(card: {
		id: string;
		cardType?: string;
		sourceUid?: string;
		clozeTemplate?: string;
		reverseOf?: string;
	}): string[] {
		if (card.cardType === "cloze" && card.sourceUid && card.clozeTemplate) {
			const siblings = this.deps.cardStore.getClozeSiblings(
				card.sourceUid,
				card.clozeTemplate,
			);
			if (siblings.length > 0) return siblings.map((s) => s.id);
		}

		if (card.cardType === "reversed" && card.reverseOf) {
			return [card.id, card.reverseOf];
		}

		const reverseCard = this.deps.cardStore.cards.getCardByReverseOf(card.id);
		if (reverseCard) return [card.id, reverseCard.id];

		return [card.id];
	}

	private getTomorrowDate(): Date {
		const now = new Date();
		const tomorrow = new Date(now);
		// If past day-start-hour, tomorrow = next calendar day at dayStartHour.
		// If before, tomorrow = today at dayStartHour.
		if (now.getHours() >= this.deps.settings.dayStartHour) {
			tomorrow.setDate(tomorrow.getDate() + 1);
		}
		tomorrow.setHours(this.deps.settings.dayStartHour, 0, 0, 0);
		return tomorrow;
	}
}
