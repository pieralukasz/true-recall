import type { FSRSCardData } from "@true-recall/core/types";

import type { Command, CommandContext } from "../command.types";

export class ChangeNoteTypeCommand implements Command {
	readonly type = "card:change-note-type";
	readonly mutationType = "cards:bulk" as const;
	readonly description = "Change note type";

	private previousNoteTypeId: string | undefined;
	private previousFields: Record<string, string> | undefined;
	private createdCardIds: string[] = [];
	private deletedCardsData: FSRSCardData[] = [];

	constructor(
		private noteId: string,
		private targetNoteTypeId: string,
		private fieldMapping: Record<string, string>,
	) {}

	execute(ctx: CommandContext): void {
		const note = ctx.cardStore.notes.getById(this.noteId);
		if (!note) return;

		this.previousNoteTypeId = note.noteTypeId;
		this.previousFields = { ...note.fields };

		const result = ctx.flashcardManager.changeNoteType(
			this.noteId,
			this.targetNoteTypeId,
			this.fieldMapping,
		);

		this.createdCardIds = result.createdCardIds;

		// Snapshot deleted cards for restore on undo
		for (const id of result.deletedCardIds) {
			const data = ctx.cardStore.get(id);
			if (data) this.deletedCardsData.push({ ...data });
		}
	}

	undo(ctx: CommandContext): void {
		if (!this.previousNoteTypeId || !this.previousFields) return;

		// Remove cards that were created during the type change
		for (const id of this.createdCardIds) {
			ctx.flashcardManager.removeFlashcardsByIds([id]);
		}

		// Restore note to previous type and fields
		ctx.cardStore.notes.update(this.noteId, {
			noteTypeId: this.previousNoteTypeId,
			fields: this.previousFields,
		});

		// Restore deleted cards
		for (const cardData of this.deletedCardsData) {
			ctx.cardStore.set(cardData.id, cardData);
		}
	}
}

export class ToggleReversedCommand implements Command {
	readonly type = "card:toggle-reversed";
	readonly mutationType = "cards:bulk" as const;
	readonly description: string;

	private previousNoteTypeId: string | undefined;
	private createdCardIds: string[] = [];
	private deletedCardsData: FSRSCardData[] = [];

	constructor(
		private noteId: string,
		private targetNoteTypeId: string,
		private fieldMapping: Record<string, string>,
	) {
		this.description =
			targetNoteTypeId === "builtin-basic-reversed"
				? "Add reversed card"
				: "Remove reversed card";
	}

	execute(ctx: CommandContext): void {
		const note = ctx.cardStore.notes.getById(this.noteId);
		if (!note) return;

		this.previousNoteTypeId = note.noteTypeId;

		const result = ctx.flashcardManager.changeNoteType(
			this.noteId,
			this.targetNoteTypeId,
			this.fieldMapping,
		);

		this.createdCardIds = result.createdCardIds;
		for (const id of result.deletedCardIds) {
			const data = ctx.cardStore.get(id);
			if (data) this.deletedCardsData.push({ ...data });
		}
	}

	undo(ctx: CommandContext): void {
		if (!this.previousNoteTypeId) return;

		for (const id of this.createdCardIds) {
			ctx.flashcardManager.removeFlashcardsByIds([id]);
		}

		ctx.cardStore.notes.update(this.noteId, {
			noteTypeId: this.previousNoteTypeId,
		});

		for (const cardData of this.deletedCardsData) {
			ctx.cardStore.set(cardData.id, cardData);
		}
	}
}
