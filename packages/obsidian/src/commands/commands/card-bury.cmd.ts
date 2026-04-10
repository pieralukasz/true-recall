import type { FSRSCardData } from "@true-recall/core/types";

import type { Command, CommandContext } from "../command.types";

export class BuryCommand implements Command {
	readonly type = "card:bury";
	readonly mutationType = "card:buried" as const;
	readonly description: string;

	private originalFsrsSnapshots: Array<{ id: string; fsrs: FSRSCardData }> = [];

	constructor(
		private cardIds: string[],
		private buriedUntil: string,
	) {
		const n = cardIds.length;
		this.description = n === 1 ? "Bury card" : `Bury ${n} cards`;
	}

	execute(ctx: CommandContext): void {
		for (const id of this.cardIds) {
			const data = ctx.cardStore.get(id);
			if (data) {
				this.originalFsrsSnapshots.push({ id, fsrs: { ...data } });
				ctx.flashcardManager.updateCardFSRS(id, {
					...data,
					buriedUntil: this.buriedUntil,
				});
			}
		}
	}

	undo(ctx: CommandContext): void {
		for (const { id, fsrs } of this.originalFsrsSnapshots) {
			ctx.flashcardManager.updateCardFSRS(id, fsrs);
		}
	}
}
