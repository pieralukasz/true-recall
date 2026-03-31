import type { Command, CommandContext } from "../command.types";

export class UpdateCardCommand implements Command {
	readonly type = "card:update";
	readonly mutationType = "card:updated" as const;
	readonly description: string;

	constructor(
		private cardId: string,
		private previousQuestion: string,
		private previousAnswer: string,
		description?: string,
	) {
		this.description = description ?? "Edit card";
	}

	execute(_ctx: CommandContext): void {
		// Content already updated by caller before constructing this command.
	}

	undo(ctx: CommandContext): void {
		// Bypass duplicate check — restoring previous content is always valid
		ctx.cardStore.cards.updateCardContent(
			this.cardId,
			this.previousQuestion,
			this.previousAnswer,
		);
	}
}

export class UpdateNoteFieldsCommand implements Command {
	readonly type = "card:update-note-fields";
	readonly mutationType = "card:updated" as const;
	readonly description: string;

	constructor(
		private noteId: string,
		private previousFields: Record<string, string>,
		description?: string,
	) {
		this.description = description ?? "Edit card";
	}

	execute(_ctx: CommandContext): void {
		// Fields already updated by caller before constructing this command.
	}

	undo(ctx: CommandContext): void {
		ctx.flashcardManager.updateNoteFields(this.noteId, this.previousFields);
	}
}
