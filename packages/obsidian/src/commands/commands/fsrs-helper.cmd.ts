import type { Command, CommandContext } from "../command.types";

interface FSRSHelperChange {
	cardId: string;
	originalDue: string;
	newDue: string;
}

export class FSRSHelperCommand implements Command {
	readonly type = "card:fsrs-helper";
	readonly mutationType = "cards:bulk" as const;

	constructor(
		readonly description: string,
		private changes: FSRSHelperChange[],
	) {}

	execute(_ctx: CommandContext): void {
		// Already executed by caller before constructing this command.
	}

	undo(ctx: CommandContext): void {
		for (const change of this.changes) {
			ctx.cardStore.cards.updateCardDue(change.cardId, change.originalDue);
		}
	}
}
