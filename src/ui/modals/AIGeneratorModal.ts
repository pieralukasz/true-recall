/**
 * AI Generator Modal
 * Allows generating flashcards using AI based on user instructions
 * Used during review mode to quickly create new cards
 */
import { App, Notice } from "obsidian";
import { BaseModal } from "./BaseModal";
import { FlashcardReviewModal } from "./FlashcardReviewModal";
import type { FlashcardItem, GeneratedNoteType } from "../../types";
import {
	OpenRouterService,
	FlashcardParserService,
} from "../../services";
import { INSTRUCTION_BASED_GENERATION_PROMPT } from "../../constants";

export interface AIGeneratorResult {
	cancelled: boolean;
	flashcards?: FlashcardItem[];
	// Options for creating a new note as destination (passed through from review modal)
	createNewNote?: boolean;
	noteType?: GeneratedNoteType;
	noteName?: string;
}

export interface AIGeneratorModalOptions {
	openRouterService: OpenRouterService;
	customSystemPrompt?: string;
}

/**
 * Modal for generating flashcards from user instructions using AI
 */
export class AIGeneratorModal extends BaseModal {
	private options: AIGeneratorModalOptions;
	private resolvePromise: ((result: AIGeneratorResult) => void) | null = null;
	private hasSelected = false;

	// UI refs
	private instructionsTextarea: HTMLTextAreaElement | null = null;
	private generateButton: HTMLButtonElement | null = null;
	private isGenerating = false;

	constructor(app: App, options: AIGeneratorModalOptions) {
		super(app, {
			title: "Generate Flashcards with AI",
			width: "500px",
		});
		this.options = options;
	}

	async openAndWait(): Promise<AIGeneratorResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-ai-generator-modal");
	}

	protected renderBody(container: HTMLElement): void {
		// Instructions section
		const instructionsSection = container.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2",
		});

		instructionsSection.createEl("label", {
			text: "What flashcards would you like to create?",
			cls: "ep:font-semibold ep:text-ui-small ep:text-obs-normal",
		});

		this.instructionsTextarea = instructionsSection.createEl("textarea", {
			cls: "ep:w-full ep:min-h-35 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:font-sans ep:text-ui-small ep:resize-y ep:leading-normal ep:focus:outline-none ep:focus:border-obs-interactive ep:disabled:opacity-60 ep:disabled:cursor-not-allowed ep:disabled:bg-obs-secondary ep:placeholder:text-obs-muted ep:placeholder:text-sm",
			attr: {
				placeholder: `Examples:
• Create a flashcard about what is an e-book reader
• Make 3 flashcards about the phases of cell division
• What is photosynthesis? (leave answer as ???)
• Create two flashcards:
  - What is machine learning?
  - How does neural network work?`,
				rows: "6",
			},
		});

		// Focus textarea on open
		setTimeout(() => this.instructionsTextarea?.focus(), 50);

		// Handle Enter key (Ctrl/Cmd+Enter to generate)
		this.instructionsTextarea.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				void this.handleGenerate();
			}
		});

		// Hint text
		const hintEl = instructionsSection.createDiv({
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:text-right",
		});
		hintEl.innerHTML = `<span class="ep:inline-block ep:py-0.5 ep:px-1.5 ep:bg-obs-border ep:rounded ep:text-obs-muted ep:font-mono ep:text-[9px]">⌘ + Enter</span> to generate`;

		// Buttons section
		const buttonsSection = container.createDiv({
			cls: "ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:mt-4 ep:border-t ep:border-obs-border",
		});

		const cancelBtn = buttonsSection.createEl("button", {
			text: "Cancel",
			cls: "ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-hover",
		});
		cancelBtn.addEventListener("click", () => this.handleCancel());

		this.generateButton = buttonsSection.createEl("button", {
			text: "Generate",
			cls: "mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
		});
		this.generateButton.addEventListener("click", () => void this.handleGenerate());
	}

	private async handleGenerate(): Promise<void> {
		const instructions = this.instructionsTextarea?.value.trim();
		if (!instructions) {
			new Notice("Please enter instructions for flashcard generation");
			return;
		}

		if (this.isGenerating) return;

		this.setGenerating(true);

		try {
			// Use the instruction-based prompt, falling back to custom prompt if provided
			const systemPrompt = this.options.customSystemPrompt?.trim()
				|| INSTRUCTION_BASED_GENERATION_PROMPT;

			// Generate flashcards using the instructions as the content
			const response = await this.options.openRouterService.generateFlashcards(
				instructions,
				undefined,
				systemPrompt
			);

			// Parse the generated flashcards
			const parser = new FlashcardParserService();
			const flashcards = parser.extractFlashcards(response);

			if (flashcards.length === 0) {
				new Notice("No flashcards could be generated. Please try different instructions.");
				this.setGenerating(false);
				return;
			}

			// Open review modal for editing before save
			const reviewModal = new FlashcardReviewModal(this.app, {
				initialFlashcards: flashcards,
				sourceNoteName: undefined,
				openRouterService: this.options.openRouterService,
			});

			const reviewResult = await reviewModal.openAndWait();

			if (reviewResult.cancelled || !reviewResult.flashcards || reviewResult.flashcards.length === 0) {
				// User cancelled the review - go back to generator
				this.setGenerating(false);
				return;
			}

			// Return the reviewed flashcards with destination options
			this.resolve({
				cancelled: false,
				flashcards: reviewResult.flashcards,
				createNewNote: reviewResult.createNewNote,
				noteType: reviewResult.noteType,
				noteName: reviewResult.noteName,
			});

		} catch (error) {
			console.error("Error generating flashcards:", error);
			new Notice(`Generation failed: ${error instanceof Error ? error.message : String(error)}`);
			this.setGenerating(false);
		}
	}

	private setGenerating(generating: boolean): void {
		this.isGenerating = generating;
		if (this.generateButton) {
			this.generateButton.disabled = generating;
			this.generateButton.textContent = generating ? "Generating..." : "Generate";
		}
		if (this.instructionsTextarea) {
			this.instructionsTextarea.disabled = generating;
		}
	}

	private resolve(result: AIGeneratorResult): void {
		this.hasSelected = true;
		if (this.resolvePromise) {
			this.resolvePromise(result);
			this.resolvePromise = null;
		}
		this.close();
	}

	private handleCancel(): void {
		this.resolve({ cancelled: true });
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
