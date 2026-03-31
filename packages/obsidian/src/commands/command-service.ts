import { mutate } from "@true-recall/obsidian/data";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { Command, CommandContext, CommandHook } from "./command.types";

export class CommandService {
	private stack: Command[] = [];
	private readonly maxStackSize = 50;
	private hooks = new Set<CommandHook>();
	private ctx: CommandContext;

	constructor(ctx: CommandContext) {
		this.ctx = ctx;
	}

	async execute(command: Command): Promise<void> {
		if (command.deferred) {
			// Deferred commands manage their own mutate() timing
			await command.execute(this.ctx);
		} else {
			await mutate(command.mutationType, () => command.execute(this.ctx));
		}

		for (const hook of this.hooks) {
			hook.afterExecute?.(command);
		}

		this.stack.push(command);
		if (this.stack.length > this.maxStackSize) {
			this.stack.shift();
		}
	}

	async undo(): Promise<boolean> {
		const command = this.stack.pop();
		if (!command) {
			notify().nothingToUndo();
			return false;
		}

		try {
			for (const hook of this.hooks) {
				hook.beforeUndo?.(command);
			}

			if (command.deferred) {
				await command.undo(this.ctx);
			} else {
				await mutate(command.mutationType, () => command.undo(this.ctx));
			}

			for (const hook of this.hooks) {
				hook.afterUndo?.(command);
			}

			notify().undoComplete(command.description);
			return true;
		} catch (error) {
			console.error("[CommandService] Error executing undo:", error);
			notify().undoFailed(command.description);
			return false;
		}
	}

	registerHook(hook: CommandHook): () => void {
		this.hooks.add(hook);
		return () => {
			this.hooks.delete(hook);
		};
	}

	canUndo(): boolean {
		return this.stack.length > 0;
	}

	peekDescription(): string | null {
		const entry = this.stack[this.stack.length - 1];
		return entry?.description ?? null;
	}

	getStackSize(): number {
		return this.stack.length;
	}

	clear(): void {
		this.stack = [];
	}

	clearByType(...types: string[]): void {
		const typeSet = new Set(types);
		this.stack = this.stack.filter((cmd) => !typeSet.has(cmd.type));
	}
}
