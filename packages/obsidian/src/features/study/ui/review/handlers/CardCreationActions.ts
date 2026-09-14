import type { FSRSFlashcardItem } from "@true-recall/core/types";
import {
	BUILTIN_BASIC_ID,
	BUILTIN_IMAGE_OCCLUSION_ID,
} from "@true-recall/core/types/note.types";

import { BatchCreateCommand } from "@true-recall/obsidian/commands/commands/card-create.cmd";
import type { AddMode } from "@true-recall/obsidian/modals/study/quick-note-editor/types";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";

import type { CardActionContext } from "./CardActionContext";
export class CardCreationActions {
	constructor(private context: CardActionContext) {}

	async handleAddNewFlashcard(): Promise<void> {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;
		await this.openAddFlashcard(card);
	}

	async handleAddCopyOfCurrentFlashcard(): Promise<void> {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		const note = card.noteId
			? this.context.deps.cardStore.notes.getById(card.noteId)
			: null;
		const noteTypeId = note?.noteTypeId ?? card.fsrs.noteTypeId;
		const canCopyNoteFields = note && noteTypeId !== BUILTIN_IMAGE_OCCLUSION_ID;

		await this.openAddFlashcard(card, {
			sourceUid: note?.sourceUid ?? card.sourceUid,
			defaultNoteTypeId: canCopyNoteFields ? noteTypeId : BUILTIN_BASIC_ID,
			initialFields: canCopyNoteFields
				? { ...note.fields }
				: { Front: card.question, Back: card.answer ?? "" },
		});
	}

	private async openAddFlashcard(
		card: FSRSFlashcardItem,
		overrides: Partial<
			Pick<AddMode, "sourceUid" | "defaultNoteTypeId" | "initialFields">
		> = {},
	): Promise<void> {
		const result = await openQuickNoteEditor(this.context.deps.plugin, {
			mode: "add",
			sourceUid: card.sourceUid,
			excludeCardId: card.id,
			defaultNoteTypeId:
				card.fsrs.noteTypeId === BUILTIN_IMAGE_OCCLUSION_ID
					? BUILTIN_BASIC_ID
					: (card.fsrs.noteTypeId ?? BUILTIN_BASIC_ID),
			...overrides,
		});
		if (!result.cancelled) {
			this.pushBatchCreateUndo(card, result.createdCards);
		}
	}

	async handleAddImageOcclusion(): Promise<void> {
		const card = this.context.deps.getReview().getCurrentCard();
		if (!card) return;

		const result = await this.context.deps.plugin.openImageOcclusionEditor({
			mode: "add",
			sourceUid: card.sourceUid,
		});
		if (!result.cancelled) {
			this.pushBatchCreateUndo(card, result.createdCards, "image occlusion ");
		}
	}

	private pushBatchCreateUndo(
		card: { sourceNotePath?: string },
		createdCards?: Array<{ id: string }>,
		_prefix = "",
	): void {
		const count = createdCards?.length ?? 0;
		if (count === 0) return;

		const cmd = new BatchCreateCommand(createdCards?.map((c) => c.id) ?? []);
		void this.context.commandService?.execute(cmd);

		const noteName = card.sourceNotePath
			?.split("/")
			.pop()
			?.replace(/\.md$/, "");
		notify().cardsCreated(count, noteName);
	}
}
