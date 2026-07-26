import { type App, TFile } from "obsidian";

import type { Command, CommandContext } from "../command.types";

/** Undo-able note append. The append is done by the caller; undo restores prior content. */
export class NoteAppendCommand implements Command {
	readonly type = "assistant:note-append";
	readonly mutationType = "card:updated" as const;
	readonly skipExecuteMutation = true;
	readonly skipUndoMutation = true;
	readonly description: string;

	constructor(
		private app: App,
		private path: string,
		private previousContent: string,
	) {
		this.description = `AI: append to ${path}`;
	}

	execute(_ctx: CommandContext): void {
		// Append already performed by the caller before constructing this command.
	}

	async undo(_ctx: CommandContext): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.path);
		if (!(file instanceof TFile)) return;
		await this.app.vault.modify(file, this.previousContent);
	}
}

/** Undo-able note creation. Creation is done by the caller; undo trashes the file. */
export class NoteCreateCommand implements Command {
	readonly type = "assistant:note-create";
	readonly mutationType = "card:updated" as const;
	readonly skipExecuteMutation = true;
	readonly skipUndoMutation = true;
	readonly description: string;

	constructor(
		private app: App,
		private path: string,
	) {
		this.description = `AI: create note ${path}`;
	}

	execute(_ctx: CommandContext): void {
		// Note already created by the caller before constructing this command.
	}

	async undo(_ctx: CommandContext): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.path);
		if (!file) return;
		await this.app.fileManager.trashFile(file);
	}
}
