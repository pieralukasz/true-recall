import type { App } from "obsidian";
import { render } from "preact";
import { ImageService } from "@features/integration/services/ImageService";
import type { FSRSFlashcardItem } from "@shared/types";
import { BaseModal } from "@shared/ui/modals/BaseModal";
import { FlashcardEditorBody } from "@shared/ui/modals/flashcard-editor/FlashcardEditorBody";
import { KeyboardShortcutsModal } from "@shared/ui/modals/flashcard-editor/KeyboardShortcutsModal";
import { MediaPickerModal } from "@shared/ui/modals/MediaPickerModal";

export { KeyboardShortcutsModal } from "@shared/ui/modals/flashcard-editor/KeyboardShortcutsModal";

export interface FlashcardEditorResult {
	cancelled: boolean;
	question: string;
	answer: string;
	newSourceNotePath?: string;
	aiInstruction?: string;
}

export interface FlashcardEditorModalOptions {
	mode: "add" | "edit";
	card?: FSRSFlashcardItem;
	currentFilePath: string;
	sourceNoteName?: string;
	prefillQuestion?: string;
	prefillAnswer?: string;
}

export class FlashcardEditorModal extends BaseModal {
	private options: FlashcardEditorModalOptions;
	private resolvePromise: ((result: FlashcardEditorResult) => void) | null =
		null;
	private hasSubmitted = false;
	private imageService: ImageService | null = null;
	private unmountBody?: () => void;

	constructor(app: App, options: FlashcardEditorModalOptions) {
		super(app, {
			title: options.mode === "add" ? "Add New Flashcard" : "Edit Flashcard",
			width: "600px",
		});
		this.options = options;
	}

	async openAndWait(): Promise<FlashcardEditorResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.imageService = new ImageService(this.app);
		super.onOpen();
		this.contentEl.addClass("true-recall-flashcard-editor-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<FlashcardEditorBody
				app={this.app}
				options={this.options}
				imageService={this.imageService as ImageService}
				onSubmit={(result) => {
					this.hasSubmitted = true;
					if (this.resolvePromise) {
						this.resolvePromise(result);
						this.resolvePromise = null;
					}
					this.close();
				}}
				onClose={() => this.close()}
				onOpenMediaPicker={async () => {
					const modal = new MediaPickerModal(this.app, {
						currentFilePath: this.options.currentFilePath,
					});
					return modal.openAndWait();
				}}
				onShowKeyboardShortcuts={() => {
					new KeyboardShortcutsModal(this.app).open();
				}}
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
				question: "",
				answer: "",
			});
			this.resolvePromise = null;
		}
	}
}
