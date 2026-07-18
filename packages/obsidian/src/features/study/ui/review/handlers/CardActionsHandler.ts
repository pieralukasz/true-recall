import type { App } from "obsidian";
import { Rating, State } from "ts-fsrs";

import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { ReviewService } from "@true-recall/core/services/review/review.service";
import type { TrueRecallSettings } from "@true-recall/core/types";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@true-recall/core/types/note.types";

import type { CommandService } from "@true-recall/obsidian/commands";
import { BatchCreateCommand } from "@true-recall/obsidian/commands/commands/card-create.cmd";
import { UpdateNoteFieldsCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";
import {
	ReviewBuryCommand,
	ReviewForgetCommand,
	ReviewSuspendCommand,
} from "@true-recall/obsidian/commands/commands/review-actions.cmd";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { MoveCardModal } from "@true-recall/obsidian/modals/shared";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";

const FORGET_NON_NEW_WARNING =
	"Forget is only available for cards that are not New.";

interface CardActionsHandlerDeps {
	app: App;
	getReview: () => ReviewApi;
	flashcardManager: FlashcardManager;
	fsrsService: FSRSService;
	reviewService: ReviewService;
	cardStore: SqliteStoreService;
	settings: TrueRecallSettings;
	plugin: TrueRecallPlugin;
}

interface CardActionsCallbacks {
	onUpdateSchedulingPreview: () => void;
}

export class CardActionsHandler {
	private deps: CardActionsHandlerDeps;
	private callbacks: CardActionsCallbacks;

	constructor(deps: CardActionsHandlerDeps, callbacks: CardActionsCallbacks) {
		this.deps = deps;
		this.callbacks = callbacks;
	}

	private get commandService(): CommandService | null {
		return this.deps.plugin.commandService ?? null;
	}

	canUndo(): boolean {
		return this.deps.plugin.commandService?.canUndo() ?? false;
	}

	canForgetCurrentCard(): boolean {
		const card = this.deps.getReview().getCurrentCard();
		return !!card && card.fsrs.state !== State.New;
	}

	handleSuspend(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const siblingIds = this.getGroupSiblingIds(card);
		const currentIndex = this.deps.getReview().currentIndex;

		const cmd = new ReviewSuspendCommand({
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			previousIndex: currentIndex,
			siblingIds,
			getReview: () => this.deps.getReview(),
		});

		void this.commandService?.execute(cmd);
		this.refreshIfActive();
		notify().cardSuspended();
	}

	handleBuryCard(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;

		const buriedUntil = this.getTomorrowDate().toISOString();
		const siblingIds = this.getGroupSiblingIds(card);
		const currentIndex = this.deps.getReview().currentIndex;

		const cmd = new ReviewBuryCommand(
			{
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
				siblingIds,
				getReview: () => this.deps.getReview(),
			},
			buriedUntil,
		);

		void this.commandService?.execute(cmd);
		this.refreshIfActive();
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

		const currentIndex = this.deps.getReview().currentIndex;

		const cmd = new ReviewForgetCommand({
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			previousIndex: currentIndex,
			siblingIds: forgettableIds,
			getReview: () => this.deps.getReview(),
		});

		void this.commandService?.execute(cmd);
		this.refreshIfActive();

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
		const buriedUntil = this.getTomorrowDate().toISOString();

		const allIds = siblingCards.map((c) => c.id);

		const cmd = new ReviewBuryCommand(
			{
				card: { ...firstSibling },
				originalFsrs: { ...firstSibling.fsrs },
				previousIndex: currentIndex,
				siblingIds: allIds,
				getReview: () => this.deps.getReview(),
			},
			buriedUntil,
		);

		void this.commandService?.execute(cmd);
		this.refreshIfActive();
		notify().cardsBuried(siblingCards.length);
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
			const { persisted } = this.deps.reviewService.gradeCard(
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

		const result = await openQuickNoteEditor(this.deps.plugin, {
			mode: "add",
			sourceUid: card.sourceUid,
			excludeCardId: card.id,
			defaultNoteTypeId:
				card.fsrs.noteTypeId === BUILTIN_IMAGE_OCCLUSION_ID
					? "builtin-basic"
					: (card.fsrs.noteTypeId ?? "builtin-basic"),
		});
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

		if (card.cardType === "note-review" && card.sourceNotePath) {
			void this.deps.plugin.app.workspace.openLinkText(
				card.sourceNotePath,
				"",
				false,
			);
			return;
		}

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

		const result = await openQuickNoteEditor(this.deps.plugin, {
			mode: "edit",
			cardId: card.id,
			noteId: note.id,
			note,
			noteType,
		});
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
		const cs = this.commandService;
		if (!cs?.canUndo()) {
			notify().nothingToUndo();
			return false;
		}
		return cs.undo();
	}

	// ── Private helpers ─────────────────────────────────

	private refreshIfActive(): void {
		if (!this.deps.getReview().isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}
	}

	/** Reload the on-screen card content after an external mutation (AI assistant apply). */
	refreshCurrentCard(): void {
		const card = this.deps.getReview().getCurrentCard();
		if (!card) return;
		const [updated] = this.deps.cardStore.cards.getByIds([card.id]);
		if (updated) {
			this.deps
				.getReview()
				.updateCurrentCardContent(
					updated.question ?? card.question,
					updated.answer ?? card.answer ?? "",
				);
		}
		this.refreshIfActive();
	}

	private pushBatchCreateUndo(
		card: { sourceNotePath?: string },
		createdCards?: Array<{ id: string }>,
		_prefix = "",
	): void {
		const count = createdCards?.length ?? 0;
		if (count === 0) return;

		const cmd = new BatchCreateCommand(createdCards?.map((c) => c.id) ?? []);
		void this.commandService?.execute(cmd);

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
		const cmd = new UpdateNoteFieldsCommand(
			noteId,
			previousFields,
			description,
		);
		void this.commandService?.execute(cmd);
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
		if (now.getHours() >= this.deps.settings.dayStartHour) {
			tomorrow.setDate(tomorrow.getDate() + 1);
		}
		tomorrow.setHours(this.deps.settings.dayStartHour, 0, 0, 0);
		return tomorrow;
	}
}
