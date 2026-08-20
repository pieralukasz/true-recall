import type { Command, CommandContext } from "../command.types";

export class UpdateCardCommand implements Command {
	readonly type = "card:update";
	readonly mutationType = "card:updated" as const;
	readonly skipExecuteMutation = true;
	readonly skipUndoMutation = true;
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
		// Restoring the previous content is always valid. Go through the manager
		// so active review sessions receive the content-change event as well.
		ctx.flashcardManager.updateCardContent(
			this.cardId,
			this.previousQuestion,
			this.previousAnswer,
			{ skipDuplicateCheck: true },
		);
	}
}

export class UpdateClozeTemplateCommand implements Command {
	readonly type = "card:update-cloze-template";
	readonly mutationType = "cards:bulk" as const;
	readonly skipExecuteMutation = true;
	readonly skipUndoMutation = true;
	readonly description: string;

	private previousSiblingIds: string[] = [];

	constructor(
		private sourceUid: string,
		private previousTemplate: string,
		private newTemplate: string,
		private sourceNoteName?: string,
		description?: string,
	) {
		this.description = description ?? "Edit cloze card";
	}

	execute(ctx: CommandContext): void {
		this.previousSiblingIds = ctx.cardStore
			.getClozeSiblings(this.sourceUid, this.previousTemplate)
			.map((card) => card.id);
		ctx.flashcardManager.updateClozeTemplate(
			this.sourceUid,
			this.previousTemplate,
			this.newTemplate,
			this.sourceNoteName,
		);
	}

	undo(ctx: CommandContext): void {
		ctx.flashcardManager.restoreClozeTemplate(
			this.sourceUid,
			this.newTemplate,
			this.previousTemplate,
			this.previousSiblingIds,
		);
	}
}

export class UpdateNoteFieldsCommand implements Command {
	readonly type = "card:update-note-fields";
	readonly mutationType = "card:updated" as const;
	readonly skipExecuteMutation = true;
	readonly skipUndoMutation = true;
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
