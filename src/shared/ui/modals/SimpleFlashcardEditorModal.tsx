import { ImageService } from "@features/integration/services/ImageService";
import { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import type { FlashcardItem } from "@shared/types";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { SimpleEditorBody } from "@shared/ui/modals/simple-editor/SimpleEditorBody";
import type { App } from "obsidian";
import { render } from "preact";

export interface SimpleFlashcardEditorResult {
	cancelled: boolean;
	flashcards: FlashcardItem[];
	editedCardId?: string;
}

export interface SimpleFlashcardEditorOptions {
	mode: "add" | "edit";
	prefillContent?: string;
	editCardId?: string;
	currentFilePath: string;
}

export class SimpleFlashcardEditorModal extends BasePromiseModal<SimpleFlashcardEditorResult> {
	private options: SimpleFlashcardEditorOptions;
	private parser: FlashcardParserService;
	private imageService: ImageService | null = null;

	constructor(app: App, options: SimpleFlashcardEditorOptions) {
		super(app, {
			title: options.mode === "add" ? "Add Flashcards" : "Edit Flashcard",
			width: "600px",
		});
		this.options = options;
		this.parser = new FlashcardParserService();
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
		render(
			<SimpleEditorBody
				app={this.app}
				options={this.options}
				parser={this.parser}
				imageService={this.imageService}
				onSubmit={(result) => this.resolve(result)}
				onClose={() => this.close()}
			/>,
			container,
		);
	}
}

export {
	cardsToMarkdown,
	cardToMarkdown,
} from "@features/study/services/flashcard/flashcard-format.util";
