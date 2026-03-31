import type { Command, CommandContext } from "../command.types";

export class BatchCreateCommand implements Command {
	readonly type = "card:create";
	readonly mutationType = "card:created" as const;
	readonly description: string;

	constructor(private cardIds: string[]) {
		const n = cardIds.length;
		this.description = n === 1 ? "Create card" : `Create ${n} cards`;
	}

	async execute(_ctx: CommandContext): Promise<void> {
		// Cards already created by caller before constructing this command.
		// execute() is a no-op; the command exists to enable undo.
	}

	async undo(ctx: CommandContext): Promise<void> {
		for (const cardId of this.cardIds) {
			await ctx.flashcardManager.removeFlashcardById(cardId);
		}
	}
}
