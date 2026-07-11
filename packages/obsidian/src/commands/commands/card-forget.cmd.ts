import type { FSRSCardData } from "@true-recall/core/types";

import type { Command, CommandContext } from "../command.types";

export class ForgetCommand implements Command {
	readonly type = "card:forget";
	readonly mutationType = "card:reset" as const;
	readonly description: string;

	private originalFsrsSnapshots: Array<{ id: string; fsrs: FSRSCardData }> = [];

	constructor(private cardIds: string[]) {
		const n = cardIds.length;
		this.description = n === 1 ? "Forget card" : `Forget ${n} cards`;
	}

	execute(ctx: CommandContext): void {
		for (const id of this.cardIds) {
			const data = ctx.cardStore.get(id);
			if (data) {
				this.originalFsrsSnapshots.push({ id, fsrs: { ...data } });
			}
		}
		ctx.cardStore.cards.bulkForget(this.cardIds);
		ctx.sessionPersistence.removeReviewedCards(this.cardIds);
	}

	undo(ctx: CommandContext): void {
		for (const { id, fsrs } of this.originalFsrsSnapshots) {
			ctx.flashcardManager.updateCardFSRS(id, fsrs, undefined, {
				skipNotification: true,
			});
		}
	}
}
