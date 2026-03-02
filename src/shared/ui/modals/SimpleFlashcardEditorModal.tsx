import { ImageService } from "@features/integration/services/ImageService";
import type { FlashcardManager } from "@features/study/services/flashcard/flashcard.service";
import type { FlashcardItem } from "@shared/types";
import type { EmbeddableEditorClass } from "@shared/ui/editor/embedded-editor";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import {
	AddFlashcardsApp,
	type AddFlashcardsResult,
} from "@shared/ui/modals/simple-editor/AddFlashcardsApp";
import type { App, TFile } from "obsidian";
import { render } from "preact";

export interface SimpleFlashcardEditorResult {
	cancelled: boolean;
	flashcards: FlashcardItem[];
	editedCardId?: string;
	totalSaved?: number;
}

export interface SimpleFlashcardEditorOptions {
	mode: "add" | "edit";
	prefillContent?: string;
	editCardId?: string;
	currentFilePath: string;
}

export class SimpleFlashcardEditorModal extends BasePromiseModal<SimpleFlashcardEditorResult> {
	private options: SimpleFlashcardEditorOptions;
	private imageService: ImageService | null = null;
	private editorClass: EmbeddableEditorClass | null;
	private flashcardManager: FlashcardManager | null;

	constructor(
		app: App,
		options: SimpleFlashcardEditorOptions,
		editorClass?: EmbeddableEditorClass | null,
		flashcardManager?: FlashcardManager | null,
	) {
		super(app, {
			title: options.mode === "add" ? "Add Flashcards" : "Edit Flashcard",
			width: "800px",
		});
		this.options = options;
		this.editorClass = editorClass ?? null;
		this.flashcardManager = flashcardManager ?? null;
	}

	protected getDefaultResult(): SimpleFlashcardEditorResult {
		return { cancelled: true, flashcards: [] };
	}

	onOpen(): void {
		this.imageService = new ImageService(this.app);
		super.onOpen();
		this.contentEl.addClass("true-recall-simple-flashcard-editor-modal");
	}

	protected renderBody(container: HTMLElement): void {
		if (!this.imageService) return;

		const initialNote = this.resolveInitialNote();

		render(
			<AddFlashcardsApp
				app={this.app}
				mode={this.options.mode}
				flashcardManager={this.flashcardManager}
				imageService={this.imageService}
				editorClass={this.editorClass}
				prefillContent={this.options.prefillContent}
				editCardId={this.options.editCardId}
				initialNote={initialNote}
				onDone={(result: AddFlashcardsResult) =>
					this.resolve({
						cancelled: result.cancelled,
						flashcards: result.flashcards,
						editedCardId: result.editedCardId,
						totalSaved: result.totalSaved,
					})
				}
				onClose={() => this.close()}
			/>,
			container,
		);
	}

	private resolveInitialNote(): TFile | null {
		const { currentFilePath } = this.options;
		if (!currentFilePath) {
			return this.app.workspace.getActiveFile();
		}
		const file = this.app.vault.getAbstractFileByPath(currentFilePath);
		if (file && "stat" in file) return file as TFile;
		return this.app.workspace.getActiveFile();
	}
}

export {
	cardsToMarkdown,
	cardToMarkdown,
} from "@features/study/services/flashcard/flashcard-format.util";
