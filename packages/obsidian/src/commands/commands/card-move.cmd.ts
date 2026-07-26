import type { Command, CommandContext } from "../command.types";

export class MoveCardCommand implements Command {
	readonly type = "card:move";
	readonly mutationType = "card:updated" as const;
	readonly skipExecuteMutation = true;
	readonly description: string;

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
		await ctx.flashcardManager.moveCard(this.cardId, this.targetNotePath);
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
