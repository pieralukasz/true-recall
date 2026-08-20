import type { FSRSCardData } from "@true-recall/core/types";

import type { MutationType } from "@true-recall/obsidian/data/queries";

import type { Command, CommandContext } from "../command.types";

/** Shared bury/unbury mechanics: both only move the `buriedUntil` boundary. */
abstract class BuriedUntilCommand implements Command {
	abstract readonly type: string;
	abstract readonly mutationType: MutationType;
	readonly description: string;

	private originalFsrsSnapshots: Array<{ id: string; fsrs: FSRSCardData }> = [];

	protected constructor(
		private cardIds: string[],
		private buriedUntil: string,
		verb: string,
	) {
		const n = cardIds.length;
		this.description = n === 1 ? `${verb} card` : `${verb} ${n} cards`;
	}

	execute(ctx: CommandContext): void {
		for (const id of this.cardIds) {
			const data = ctx.cardStore.get(id);
			if (data) {
				this.originalFsrsSnapshots.push({ id, fsrs: { ...data } });
				ctx.flashcardManager.updateCardFSRS(
					id,
					{
						...data,
						buriedUntil: this.buriedUntil,
					},
					undefined,
					{ skipNotification: true },
				);
			}
		}
	}

	undo(ctx: CommandContext): void {
		for (const { id, fsrs } of this.originalFsrsSnapshots) {
			ctx.flashcardManager.updateCardFSRS(id, fsrs, undefined, {
				skipNotification: true,
			});
		}
	}
}

export class BuryCommand extends BuriedUntilCommand {
	readonly type = "card:bury";
	readonly mutationType = "card:buried" as const;

	constructor(cardIds: string[], buriedUntil: string) {
		super(cardIds, buriedUntil, "Bury");
	}
}

export class UnburyCommand extends BuriedUntilCommand {
	readonly type = "card:unbury";
	readonly mutationType = "card:unburied" as const;

	/**
	 * Lifts a bury by moving the boundary into the past instead of clearing it —
	 * an elapsed date reads as "not buried" everywhere and keeps the undo
	 * snapshot symmetric with {@link BuryCommand}.
	 */
	constructor(cardIds: string[], now: Date = new Date()) {
		super(cardIds, now.toISOString(), "Unbury");
	}
}
