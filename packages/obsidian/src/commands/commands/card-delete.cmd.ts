import type { FSRSCardData } from "@true-recall/core/types";

import type { Command, CommandContext } from "../command.types";

export class DeleteCardCommand implements Command {
	readonly type = "card:delete";
	readonly mutationType = "card:deleted" as const;
	readonly skipExecuteMutation = true;
	readonly description: string;

	deletedCount = 0;
	private deletedCardsData: FSRSCardData[] = [];

	constructor(private cardIds: string[]) {
		this.description =
			cardIds.length === 1 ? "Delete card" : `Delete ${cardIds.length} cards`;
	}

	execute(ctx: CommandContext): void {
		const result = ctx.flashcardManager.removeFlashcardsByIdsWithDetails(
			this.cardIds,
		);
		this.deletedCardsData = result.deletedCardsData;
		this.deletedCount = result.affectedCount;
	}

	undo(ctx: CommandContext): void {
		for (const cardData of this.deletedCardsData) {
			ctx.cardStore.set(cardData.id, cardData);
		}
	}
}
