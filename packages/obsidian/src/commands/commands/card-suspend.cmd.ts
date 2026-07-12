import type { Command, CommandContext } from "../command.types";

/**
 * Multi-select from the panel routinely mixes suspended and unsuspended
 * cards, so undo must restore each card's original flag instead of blindly
 * inverting the whole selection (which used to unsuspend cards that were
 * already suspended before the command, and vice versa).
 */
function captureSuspended(
	ctx: CommandContext,
	cardIds: string[],
): Map<string, boolean> {
	const snapshot = new Map<string, boolean>();
	for (const id of cardIds) {
		const data = ctx.cardStore.get(id);
		if (data) snapshot.set(id, data.suspended === true);
	}
	return snapshot;
}

function restoreSuspended(
	ctx: CommandContext,
	snapshot: Map<string, boolean>,
): void {
	const toSuspend: string[] = [];
	const toUnsuspend: string[] = [];
	for (const [id, wasSuspended] of snapshot) {
		(wasSuspended ? toSuspend : toUnsuspend).push(id);
	}
	if (toSuspend.length > 0) ctx.cardStore.cards.bulkSuspend(toSuspend);
	if (toUnsuspend.length > 0) ctx.cardStore.cards.bulkUnsuspend(toUnsuspend);
}

export class SuspendCommand implements Command {
	readonly type = "card:suspend";
	readonly mutationType = "card:suspended" as const;
	readonly description: string;

	private snapshot = new Map<string, boolean>();

	constructor(private cardIds: string[]) {
		const n = cardIds.length;
		this.description = n === 1 ? "Suspend card" : `Suspend ${n} cards`;
	}

	execute(ctx: CommandContext): void {
		this.snapshot = captureSuspended(ctx, this.cardIds);
		ctx.cardStore.cards.bulkSuspend(this.cardIds);
	}

	undo(ctx: CommandContext): void {
		restoreSuspended(ctx, this.snapshot);
	}
}

export class UnsuspendCommand implements Command {
	readonly type = "card:unsuspend";
	readonly mutationType = "card:unsuspended" as const;
	readonly description: string;

	private snapshot = new Map<string, boolean>();

	constructor(private cardIds: string[]) {
		const n = cardIds.length;
		this.description = n === 1 ? "Unsuspend card" : `Unsuspend ${n} cards`;
	}

	execute(ctx: CommandContext): void {
		this.snapshot = captureSuspended(ctx, this.cardIds);
		ctx.cardStore.cards.bulkUnsuspend(this.cardIds);
	}

	undo(ctx: CommandContext): void {
		restoreSuspended(ctx, this.snapshot);
	}
}
