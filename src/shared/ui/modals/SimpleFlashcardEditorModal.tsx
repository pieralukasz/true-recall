import { ImageService } from "@features/integration/services/ImageService";
import { FlashcardParserService } from "@features/study/services/flashcard/flashcard-parser.service";
import type { FlashcardItem } from "@shared/types";
import { BaseModal } from "@shared/ui/modals/BaseModal";
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

export class SimpleFlashcardEditorModal extends BaseModal {
	private options: SimpleFlashcardEditorOptions;
	private resolvePromise:
		| ((result: SimpleFlashcardEditorResult) => void)
		| null = null;
	private hasSubmitted = false;
	private parser: FlashcardParserService;
	private imageService: ImageService | null = null;
	private unmountBody?: () => void;

	constructor(app: App, options: SimpleFlashcardEditorOptions) {
		super(app, {
			title: options.mode === "add" ? "Add Flashcards" : "Edit Flashcard",
			width: "600px",
		});
		this.options = options;
		this.parser = new FlashcardParserService();
	}

	async openAndWait(): Promise<SimpleFlashcardEditorResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
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
				onSubmit={(result) => {
					this.hasSubmitted = true;
					if (this.resolvePromise) {
						this.resolvePromise(result);
						this.resolvePromise = null;
					}
					this.close();
				}}
				onClose={() => this.close()}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();

		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSubmitted && this.resolvePromise) {
			this.resolvePromise({
				cancelled: true,
				flashcards: [],
			});
			this.resolvePromise = null;
		}
	}
}

export {
	cardsToMarkdown,
	cardToMarkdown,
} from "@features/study/services/flashcard/flashcard-format.util";
