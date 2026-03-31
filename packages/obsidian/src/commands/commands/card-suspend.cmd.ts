import type { Command, CommandContext } from "../command.types";

export class SuspendCommand implements Command {
	readonly type = "card:suspend";
	readonly mutationType = "card:suspended" as const;
	readonly description: string;

	constructor(private cardIds: string[]) {
		const n = cardIds.length;
		this.description = n === 1 ? "Suspend card" : `Suspend ${n} cards`;
	}

	execute(ctx: CommandContext): void {
		ctx.cardStore.cards.bulkSuspend(this.cardIds);
	}

	undo(ctx: CommandContext): void {
		ctx.cardStore.cards.bulkUnsuspend(this.cardIds);
	}
}

export class UnsuspendCommand implements Command {
	readonly type = "card:unsuspend";
	readonly mutationType = "card:unsuspended" as const;
	readonly description: string;

	constructor(private cardIds: string[]) {
		const n = cardIds.length;
		this.description = n === 1 ? "Unsuspend card" : `Unsuspend ${n} cards`;
	}

	execute(ctx: CommandContext): void {
		ctx.cardStore.cards.bulkUnsuspend(this.cardIds);
	}

	undo(ctx: CommandContext): void {
		ctx.cardStore.cards.bulkSuspend(this.cardIds);
	}
}
