import type { Command, CommandContext } from "../command.types";

export class MoveCardCommand implements Command {
	readonly type = "card:move";
	readonly mutationType = "card:updated" as const;
	readonly skipExecuteMutation = true;
	readonly description: string;

	/** False when the card no longer existed, so nothing was moved. */
	moved = false;
	private originalSourceUid: string | undefined;

	constructor(
		private cardId: string,
		private targetNotePath: string,
	) {
		this.description = "Move card";
	}

	async execute(ctx: CommandContext): Promise<void> {
		const card = ctx.cardStore.get(this.cardId);
		this.originalSourceUid = card?.sourceUid;
		this.moved = await ctx.flashcardManager.moveCard(
			this.cardId,
			this.targetNotePath,
		);
	}

	undo(ctx: CommandContext): void {
		if (this.originalSourceUid) {
			ctx.cardStore.cards.updateCardSourceUid(
				this.cardId,
				this.originalSourceUid,
			);
		}
	}
}

/**
 * Moves several cards to one note as a single undo step. Each card goes
 * through the manager, so every move emits the same domain event as a
 * single-card move.
 */
export class MoveCardsCommand implements Command {
	readonly type = "cards:move";
	readonly mutationType = "cards:bulk" as const;
	readonly skipExecuteMutation = true;
	readonly description: string;

	movedCount = 0;
	private originalSourceUids = new Map<string, string>();

	constructor(
		private cardIds: readonly string[],
		private targetNotePath: string,
	) {
		this.description =
			cardIds.length === 1 ? "Move card" : `Move ${cardIds.length} cards`;
	}

	async execute(ctx: CommandContext): Promise<void> {
		this.movedCount = 0;
		this.originalSourceUids.clear();
		for (const cardId of this.cardIds) {
			const sourceUid = ctx.cardStore.get(cardId)?.sourceUid;
			const moved = await ctx.flashcardManager.moveCard(
				cardId,
				this.targetNotePath,
			);
			if (!moved) continue;
			this.movedCount += 1;
			if (sourceUid) this.originalSourceUids.set(cardId, sourceUid);
		}
	}

	undo(ctx: CommandContext): void {
		for (const [cardId, sourceUid] of this.originalSourceUids) {
			ctx.cardStore.cards.updateCardSourceUid(cardId, sourceUid);
		}
	}
}
