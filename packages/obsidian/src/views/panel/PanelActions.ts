import type { FlashcardItem } from "@true-recall/core/types";

import type { CommandService } from "@true-recall/obsidian/commands";
import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import {
	csvFilenameFor,
	flashcardsToCsv,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-csv";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { PanelApi } from "@true-recall/obsidian/store";

export interface PanelActionsDeps {
	openNote: (path: string) => Promise<void>;
	getPanel: () => PanelApi;
	getCommandService: () => Pick<CommandService, "execute" | "undo"> | null;
	cardsToText: (cards: FlashcardItem[]) => string;
	confirm: (message: string) => Promise<boolean>;
	writeClipboard: (text: string) => Promise<void>;
	downloadFile: (content: string, filename: string, mimeType: string) => void;
}

/** Note-level panel actions: open, delete with undo, copy, CSV export. */
export class PanelActions {
	constructor(private deps: PanelActionsDeps) {}

	private get panel(): PanelApi {
		return this.deps.getPanel();
	}

	async openFlashcardFile(): Promise<void> {
		const file = this.panel.currentFile;
		if (file) {
			await this.deps.openNote(file.path);
		}
	}

	async deleteAllFlashcards(): Promise<void> {
		const flashcards = this.panel.flashcardInfo?.flashcards;
		if (!flashcards || flashcards.length === 0) return;

		const confirmed = await this.deps.confirm(
			`Delete all ${flashcards.length} flashcard(s) for this note?`,
		);
		if (!confirmed) return;

		const commandService = this.deps.getCommandService();
		const cmd = new DeleteCardCommand(flashcards.map((card) => card.id));
		await commandService?.execute(cmd);
		notify().cardsDeletedWithUndo(cmd.deletedCount, () => {
			void this.deps.getCommandService()?.undo();
		});
	}

	async copyAllToClipboard(): Promise<void> {
		const flashcards = this.panel.flashcardInfo?.flashcards;
		if (!flashcards || flashcards.length === 0) {
			notify().warning("No flashcards to copy");
			return;
		}

		await this.deps.writeClipboard(this.deps.cardsToText(flashcards));
		notify().success(`Copied ${flashcards.length} flashcard(s) to clipboard`);
	}

	exportCsv(): void {
		const panel = this.panel;
		const flashcards = panel.flashcardInfo?.flashcards;
		if (!flashcards || flashcards.length === 0) {
			notify().warning("No flashcards to export");
			return;
		}

		this.deps.downloadFile(
			flashcardsToCsv(flashcards),
			csvFilenameFor(panel.currentFile?.basename),
			"text/csv;charset=utf-8;",
		);
		notify().success(`Exported ${flashcards.length} flashcard(s) to CSV`);
	}
}
