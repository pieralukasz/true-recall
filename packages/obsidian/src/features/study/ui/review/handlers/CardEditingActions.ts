import { BUILTIN_IMAGE_OCCLUSION_ID } from "@true-recall/core/types/note.types";

import { UpdateNoteFieldsCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";

import type { CardActionContext } from "./CardActionContext";
export class CardEditingActions {
	constructor(private context: CardActionContext) {}

	async handleEditCardModal(): Promise<void> {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		if (card.cardType === "note-review" && card.sourceNotePath) {
			void this.context.deps.plugin.app.workspace.openLinkText(
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

		const note = this.context.deps.cardStore.notes.getById(card.noteId);
		if (!note) {
			notify().error("Note not found");
			return;
		}
		const noteType = this.context.deps.cardStore.noteTypes.getById(
			note.noteTypeId,
		);
		if (!noteType) {
			notify().error("Note type not found");
			return;
		}

		const previousFields = { ...note.fields };

		if (noteType.id === BUILTIN_IMAGE_OCCLUSION_ID) {
			const result = await this.context.deps.plugin.openImageOcclusionEditor({
				mode: "edit",
				noteId: note.id,
				note,
			});
			if (result.cancelled) return;

			this.pushFieldEditUndo(note.id, previousFields, "Edit image occlusion");
			return;
		}

		const result = await openQuickNoteEditor(this.context.deps.plugin, {
			mode: "edit",
			cardId: card.id,
			noteId: note.id,
			note,
			noteType,
		});
		if (result.cancelled) return;

		this.pushFieldEditUndo(note.id, previousFields, "Edit card");

		if (result.updatedCardIds?.includes(card.id)) {
			const [updatedCard] = this.context.deps.cardStore.cards.getByIds([
				card.id,
			]);
			if (updatedCard) {
				this.context.deps
					.getReview()
					.updateCurrentCardContent(
						updatedCard.question ?? card.question,
						updatedCard.answer ?? card.answer ?? "",
					);
				this.context.deps
					.getReview()
					.updateCurrentCardComment(updatedCard.userComment);
			}
		}
	}

	async handleEditComment(): Promise<void> {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card?.noteId) {
			notify().error("Cannot add a note: this card has no backing note.");
			return;
		}

		const { promptCardComment } = await import(
			"@true-recall/obsidian/modals/study/CardCommentModal"
		);
		const value = await promptCardComment(
			this.context.deps.app,
			card.userComment ?? "",
		);
		if (value === null || value === (card.userComment ?? "")) return;

		try {
			this.context.deps.flashcardManager.updateNoteComment(card.noteId, value);
			this.context.deps
				.getReview()
				.updateCurrentCardComment(value || undefined);
			notify().success(value ? "Note saved" : "Note removed");
		} catch (error) {
			notify().operationFailed("save note", error);
		}
	}

	handleRemoveComment(): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card?.noteId || !card.userComment) return;

		try {
			this.context.deps.flashcardManager.updateNoteComment(card.noteId, "");
			this.context.deps.getReview().updateCurrentCardComment(undefined);
			notify().success("Note removed");
		} catch (error) {
			notify().operationFailed("remove note", error);
		}
	}

	async handleChangeNoteType(): Promise<void> {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card?.noteId) return;

		const note = this.context.deps.cardStore.notes.getById(card.noteId);
		if (!note) {
			notify().error("Note not found");
			return;
		}

		const currentNoteType = this.context.deps.cardStore.noteTypes.getById(
			note.noteTypeId,
		);
		if (!currentNoteType) {
			notify().error("Note type not found");
			return;
		}

		const { ChangeNoteTypeModal } = await import(
			"@true-recall/obsidian/modals/library/ChangeNoteTypeModal"
		);

		const allNoteTypes = this.context.deps.cardStore.noteTypes.getAll();
		const modal = new ChangeNoteTypeModal(this.context.deps.app, {
			currentNoteType,
			availableNoteTypes: allNoteTypes,
			noteCount: 1,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNoteTypeId || !result.fieldMapping)
			return;

		const r = this.context.deps.flashcardManager.changeNoteType(
			card.noteId,
			result.targetNoteTypeId,
			result.fieldMapping,
		);

		for (const id of r.deletedCardIds) {
			this.context.deps.getReview().removeCardById(id);
		}
		if (!r.keptCardIds.includes(card.id)) {
			this.context.deps.getReview().removeCardById(card.id);
		}
		this.context.removeFromTemporaryDeck([
			...r.deletedCardIds,
			...(r.keptCardIds.includes(card.id) ? [] : [card.id]),
		]);

		this.context.refreshIfActive();

		const parts: string[] = ["Note type changed"];
		if (r.createdCardIds.length > 0)
			parts.push(`${r.createdCardIds.length} cards created`);
		if (r.deletedCardIds.length > 0)
			parts.push(`${r.deletedCardIds.length} cards removed`);
		notify().success(parts.join(", "));
	}

	/** Reload the on-screen card content after an external mutation (AI assistant apply). */
	refreshCurrentCard(): void {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;
		const [updated] = this.context.deps.cardStore.cards.getByIds([card.id]);
		if (updated) {
			this.context.deps
				.getReview()
				.updateCurrentCardContent(
					updated.question ?? card.question,
					updated.answer ?? card.answer ?? "",
				);
			this.context.deps
				.getReview()
				.updateCurrentCardComment(updated.userComment);
		}
		this.context.refreshIfActive();
	}

	private pushFieldEditUndo(
		noteId: string,
		previousFields: Record<string, string>,
		description: string,
	): void {
		const nextFields = {
			...(this.context.deps.cardStore.notes.getById(noteId)?.fields ??
				previousFields),
		};
		const cmd = new UpdateNoteFieldsCommand(
			noteId,
			previousFields,
			nextFields,
			description,
		);
		void this.context.commandService?.execute(cmd);
	}
}
