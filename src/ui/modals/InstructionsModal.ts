/**
 * Instructions Modal
 * Shows before AI generation to let user provide instructions
 */
import { App } from "obsidian";
import { BasePromiseModal } from "./BasePromiseModal";

export interface InstructionsModalOptions {
	sourceText: string;
	sourceNoteName?: string;
}

export interface InstructionsModalResult {
	cancelled: boolean;
	instructions?: string;
}

/**
 * Modal for entering instructions before AI flashcard generation
 */
export class InstructionsModal extends BasePromiseModal<InstructionsModalResult> {
	private options: InstructionsModalOptions;

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

	protected getDefaultResult(): InstructionsModalResult {
		return { cancelled: true };
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
		this.renderButtonsSection(container);
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
			cls: "ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:text-ui-small ep:text-obs-normal ep:max-h-40 ep:overflow-y-auto ep:whitespace-pre-wrap ep:break-words",
		});

		// Show full text (scrollable if too long)
		previewEl.textContent = this.options.sourceText;
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
			cls: "ep:w-full ep:min-h-44 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:font-sans ep:text-ui-small ep:resize-y ep:leading-normal ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:placeholder:text-sm",
			attr: {
				placeholder: `How should AI generate flashcards?

Examples:
- focus on key terms and definitions
- create 3 simple question-answer pairs
- make cards about the main concepts only
- use simple language, avoid jargon`,
				rows: "8",
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

		// Show source note name if available
		if (this.options.sourceNoteName) {
			const sourceLabel = instructionsSection.createDiv({
				cls: "ep:text-ui-smaller ep:text-obs-faint ep:mt-2",
			});
			sourceLabel.textContent = `Source: ${this.options.sourceNoteName}`;
		}
	}

	private renderButtonsSection(container: HTMLElement): void {
		const buttonsEl = this.createButtonsSection(container, [
			{
				text: "Generate",
				type: "primary",
				onClick: () => this.handleGenerate(),
			},
		]);

		// Store reference to generate button for potential disabling
		this.generateButton = buttonsEl.querySelector(
			"button"
		) as HTMLButtonElement;
	}

	private handleGenerate(): void {
		const instructions = this.instructionsTextarea?.value.trim() || undefined;
		this.resolve({
			cancelled: false,
			instructions,
		});
	}
}
