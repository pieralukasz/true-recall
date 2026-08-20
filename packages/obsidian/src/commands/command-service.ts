import { mutate } from "@true-recall/obsidian/data";
import { notify } from "@true-recall/obsidian/services/notification.service";

import type { Command, CommandContext, CommandHook } from "./command.types";

interface CommandHistoryEntry {
	command: Command;
	order: number;
}

let latestCommandOrder = 0;

function nextCommandOrder(): number {
	latestCommandOrder += 1;
	return latestCommandOrder;
}

export class CommandService {
	private stack: CommandHistoryEntry[] = [];
	private redoStack: CommandHistoryEntry[] = [];
	private readonly maxStackSize = 50;
	private hooks = new Set<CommandHook>();
	private ctx: CommandContext;

	constructor(ctx: CommandContext) {
		this.ctx = ctx;
	}

	async execute(command: Command): Promise<void> {
		if (command.deferred || command.skipExecuteMutation) {
			await command.execute(this.ctx);
		} else {
			await mutate(command.mutationType, () => command.execute(this.ctx));
		}

		for (const hook of this.hooks) {
			hook.afterExecute?.(command);
		}

		this.stack.push({ command, order: nextCommandOrder() });
		if (this.stack.length > this.maxStackSize) {
			this.stack.shift();
		}

		// New action invalidates redo history
		this.redoStack = [];
	}

	async undo(): Promise<boolean> {
		const entry = this.stack.pop();
		if (!entry) {
			notify().nothingToUndo();
			return false;
		}
		const { command } = entry;

		try {
			for (const hook of this.hooks) {
				hook.beforeUndo?.(command);
			}

			if (command.deferred || command.skipUndoMutation) {
				await command.undo(this.ctx);
			} else {
				await mutate(command.mutationType, () => command.undo(this.ctx));
			}

			for (const hook of this.hooks) {
				hook.afterUndo?.(command);
			}

			// Deferred commands can't be redone (ephemeral queue state)
			if (!command.deferred) {
				this.redoStack.push({ command, order: nextCommandOrder() });
			}

			notify().undoComplete(command.description);
			return true;
		} catch (error) {
			console.error("[CommandService] Error executing undo:", error);
			notify().undoFailed(command.description);
			return false;
		}
	}

	async redo(): Promise<boolean> {
		const entry = this.redoStack.pop();
		if (!entry) {
			notify().nothingToRedo();
			return false;
		}
		const { command } = entry;

		try {
			for (const hook of this.hooks) {
				hook.beforeRedo?.(command);
			}

			if (command.skipExecuteMutation) {
				await command.execute(this.ctx);
			} else {
				await mutate(command.mutationType, () => command.execute(this.ctx));
			}

			for (const hook of this.hooks) {
				hook.afterRedo?.(command);
			}

			this.stack.push({ command, order: nextCommandOrder() });

			notify().redoComplete(command.description);
			return true;
		} catch (error) {
			console.error("[CommandService] Error executing redo:", error);
			notify().redoFailed(command.description);
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

	isNextUndo(command: Command): boolean {
		return this.stack[this.stack.length - 1]?.command === command;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	peekDescription(): string | null {
		const entry = this.stack[this.stack.length - 1];
		return entry?.command.description ?? null;
	}

	peekUndoOrder(): number | null {
		return this.stack[this.stack.length - 1]?.order ?? null;
	}

	peekRedoOrder(): number | null {
		return this.redoStack[this.redoStack.length - 1]?.order ?? null;
	}

	static currentOrder(): number {
		return latestCommandOrder;
	}

	static newestUndoService(
		services: ReadonlyArray<CommandService | null | undefined>,
		afterOrder = 0,
	): CommandService | null {
		return CommandService.newestService(
			services,
			(service) => service.peekUndoOrder(),
			afterOrder,
		);
	}

	static newestRedoService(
		services: ReadonlyArray<CommandService | null | undefined>,
		afterOrder = 0,
	): CommandService | null {
		return CommandService.newestService(
			services,
			(service) => service.peekRedoOrder(),
			afterOrder,
		);
	}

	private static newestService(
		services: ReadonlyArray<CommandService | null | undefined>,
		getOrder: (service: CommandService) => number | null,
		afterOrder: number,
	): CommandService | null {
		let newest: CommandService | null = null;
		let newestOrder = afterOrder;
		for (const service of services) {
			if (!service) continue;
			const order = getOrder(service);
			if (order !== null && order > newestOrder) {
				newest = service;
				newestOrder = order;
			}
		}
		return newest;
	}

	getStackSize(): number {
		return this.stack.length;
	}

	clear(): void {
		this.stack = [];
		this.redoStack = [];
	}

	clearByType(...types: string[]): void {
		const typeSet = new Set(types);
		this.stack = this.stack.filter((entry) => !typeSet.has(entry.command.type));
		this.redoStack = this.redoStack.filter(
			(entry) => !typeSet.has(entry.command.type),
		);
	}
}
