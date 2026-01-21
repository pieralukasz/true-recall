/**
 * AI Generator Modal
 * Allows generating flashcards using AI based on user instructions
 * Used during review mode to quickly create new cards
 */
import { App, Notice } from "obsidian";
import { BaseModal } from "./BaseModal";
import { FlashcardReviewModal } from "./FlashcardReviewModal";
import type { FlashcardItem } from "../../types";
import {
	OpenRouterService,
	FlashcardParserService,
} from "../../services";
import { INSTRUCTION_BASED_GENERATION_PROMPT } from "../../constants";

export interface AIGeneratorResult {
	cancelled: boolean;
	flashcards?: FlashcardItem[];
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
			cls: "episteme-ai-generator-section",
		});

		instructionsSection.createEl("label", {
			text: "What flashcards would you like to create?",
			cls: "episteme-ai-generator-label",
		});

		this.instructionsTextarea = instructionsSection.createEl("textarea", {
			cls: "episteme-ai-generator-textarea",
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
			cls: "episteme-ai-generator-hint",
		});
		hintEl.innerHTML = `<span class="episteme-key-hint">⌘ + Enter</span> to generate`;

		// Buttons section
		const buttonsSection = container.createDiv({
			cls: "episteme-ai-generator-buttons",
		});

		const cancelBtn = buttonsSection.createEl("button", {
			text: "Cancel",
			cls: "episteme-btn episteme-btn-secondary",
		});
		cancelBtn.addEventListener("click", () => this.handleCancel());

		this.generateButton = buttonsSection.createEl("button", {
			text: "Generate",
			cls: "mod-cta episteme-btn episteme-btn-primary",
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

			// Return the reviewed flashcards
			this.resolve({
				cancelled: false,
				flashcards: reviewResult.flashcards,
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
