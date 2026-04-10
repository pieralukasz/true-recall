import type { MutationType } from "@true-recall/obsidian/data/queries";

import type { Command, CommandContext } from "./command.types";

class CompoundCommand implements Command {
	readonly type: string;
	readonly deferred = false;

	constructor(
		readonly description: string,
		readonly mutationType: MutationType,
		private commands: Command[],
	) {
		this.type = commands[0]?.type ?? "compound";
	}

	execute(ctx: CommandContext): void {
		for (const cmd of this.commands) {
			cmd.execute(ctx);
		}
	}

	undo(ctx: CommandContext): void {
		for (let i = this.commands.length - 1; i >= 0; i--) {
			this.commands[i]?.undo(ctx);
		}
	}
}
