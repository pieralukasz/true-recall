/**
 * Instructions Modal
 * Shows before AI generation to let user provide instructions
 */
import { App } from "obsidian";
import { BaseModal } from "./BaseModal";

export interface InstructionsModalOptions {
	sourceText: string;
	sourceNoteName?: string;
}

export interface InstructionsModalResult {
	cancelled: boolean;
	instructions?: string;
}

const MAX_PREVIEW_LENGTH = 200;

/**
 * Modal for entering instructions before AI flashcard generation
 */
export class InstructionsModal extends BaseModal {
	private options: InstructionsModalOptions;
	private resolvePromise: ((result: InstructionsModalResult) => void) | null = null;
	private hasSelected = false;

	// UI refs
	private instructionsTextarea: HTMLTextAreaElement | null = null;
	private generateButton: HTMLButtonElement | null = null;

	constructor(app: App, options: InstructionsModalOptions) {
		super(app, {
			title: "Generate Flashcards",
			width: "500px",
		});
		this.options = options;
	}

	async openAndWait(): Promise<InstructionsModalResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-instructions-modal");
	}

	protected renderBody(container: HTMLElement): void {
		// Source text preview
		this.renderSourcePreview(container);

		// Instructions section
		this.renderInstructionsSection(container);

		// Buttons section
		this.renderButtons(container);
	}

	private renderSourcePreview(container: HTMLElement): void {
		const previewSection = container.createDiv({
			cls: "ep:mb-4",
		});

		previewSection.createEl("label", {
			text: "Selected text",
			cls: "ep:block ep:font-medium ep:text-ui-small ep:text-obs-muted ep:mb-1.5",
		});

		const previewEl = previewSection.createDiv({
			cls: "ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:text-ui-small ep:text-obs-normal ep:max-h-24 ep:overflow-y-auto ep:whitespace-pre-wrap ep:break-words",
		});

		// Truncate text if too long
		const text = this.options.sourceText;
		if (text.length > MAX_PREVIEW_LENGTH) {
			previewEl.textContent = text.substring(0, MAX_PREVIEW_LENGTH) + "...";
		} else {
			previewEl.textContent = text;
		}

		// Show source note name if available
		if (this.options.sourceNoteName) {
			const sourceLabel = previewSection.createDiv({
				cls: "ep:text-ui-smaller ep:text-obs-faint ep:mt-1",
			});
			sourceLabel.textContent = `From: ${this.options.sourceNoteName}`;
		}
	}

	private renderInstructionsSection(container: HTMLElement): void {
		const instructionsSection = container.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2 ep:mb-4",
		});

		instructionsSection.createEl("label", {
			text: "Instructions (optional)",
			cls: "ep:font-medium ep:text-ui-small ep:text-obs-normal",
		});

		this.instructionsTextarea = instructionsSection.createEl("textarea", {
			cls: "ep:w-full ep:min-h-24 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:font-sans ep:text-ui-small ep:resize-y ep:leading-normal ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:placeholder:text-sm",
			attr: {
				placeholder: `How should AI generate flashcards?

Examples:
- focus on key terms and definitions
- create 3 simple question-answer pairs
- make cards about the main concepts only
- use simple language, avoid jargon`,
				rows: "4",
			},
		});

		// Focus textarea on open
		setTimeout(() => this.instructionsTextarea?.focus(), 50);

		// Handle Enter key (Ctrl/Cmd+Enter to generate)
		this.instructionsTextarea.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				this.handleGenerate();
			}
		});

		// Hint text
		const hintEl = instructionsSection.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:text-right",
		});
		hintEl.createEl("kbd", {
			text: "\u2318 + Enter",
			cls: "ep:inline-block ep:py-0.5 ep:px-1.5 ep:bg-obs-border ep:rounded ep:text-obs-muted ep:font-mono ep:text-[9px]",
		});
		hintEl.appendText(" to generate");
	}

	private renderButtons(container: HTMLElement): void {
		const buttonsSection = container.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border",
		});

		const skipBtn = buttonsSection.createEl("button", {
			text: "Skip",
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-hover",
		});
		skipBtn.addEventListener("click", () => this.handleSkip());

		this.generateButton = buttonsSection.createEl("button", {
			text: "Generate",
			cls: "mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer",
		});
		this.generateButton.addEventListener("click", () => this.handleGenerate());
	}

	private handleGenerate(): void {
		const instructions = this.instructionsTextarea?.value.trim() || undefined;
		this.resolve({
			cancelled: false,
			instructions,
		});
	}

	private handleSkip(): void {
		// Generate without instructions
		this.resolve({
			cancelled: false,
			instructions: undefined,
		});
	}

	private handleCancel(): void {
		this.resolve({ cancelled: true });
	}

	private resolve(result: InstructionsModalResult): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(result);
			this.resolvePromise = null;
		}
		this.close();
	}

	onClose(): void {
		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise({ cancelled: true });
			this.resolvePromise = null;
		}

		const { contentEl } = this;
		contentEl.empty();
	}
}
