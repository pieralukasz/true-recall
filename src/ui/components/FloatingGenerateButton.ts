/**
 * Floating Generate Button Component
 * Shows a FAB when text is selected in markdown editor
 */
import { Notice, TFile } from "obsidian";
import type TrueRecallPlugin from "../../main";

export class FloatingGenerateButton {
	private plugin: TrueRecallPlugin;
	private buttonEl: HTMLElement | null = null;
	private isVisible = false;
	private selectionCheckInterval: number | null = null;
	private currentSelection = "";

	constructor(plugin: TrueRecallPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Initialize the floating button (attach to workspace)
	 */
	initialize(): void {
		this.createButton();
		this.startSelectionMonitoring();
	}

	/**
	 * Cleanup when plugin unloads
	 */
	destroy(): void {
		this.stopSelectionMonitoring();
		this.removeButton();
	}

	private createButton(): void {
		// Create button element
		this.buttonEl = document.createElement("div");
		this.buttonEl.addClass("ep-floating-generate-btn");
		this.buttonEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/></svg>`;
		this.buttonEl.setAttribute("aria-label", "Generate flashcards from selection");
		this.buttonEl.style.display = "none";

		// Add click handler
		this.buttonEl.addEventListener("click", () => this.handleClick());

		// Append to body
		document.body.appendChild(this.buttonEl);
	}

	private removeButton(): void {
		if (this.buttonEl) {
			this.buttonEl.remove();
			this.buttonEl = null;
		}
	}

	private startSelectionMonitoring(): void {
		// Check selection every 200ms
		this.selectionCheckInterval = window.setInterval(() => {
			this.checkSelection();
		}, 200);

		// Also listen for mouseup for faster response
		document.addEventListener("mouseup", this.handleMouseUp);
		document.addEventListener("keyup", this.handleKeyUp);
	}

	private stopSelectionMonitoring(): void {
		if (this.selectionCheckInterval !== null) {
			window.clearInterval(this.selectionCheckInterval);
			this.selectionCheckInterval = null;
		}
		document.removeEventListener("mouseup", this.handleMouseUp);
		document.removeEventListener("keyup", this.handleKeyUp);
	}

	private handleMouseUp = (): void => {
		// Small delay to let selection finalize
		setTimeout(() => this.checkSelection(), 50);
	};

	private handleKeyUp = (e: KeyboardEvent): void => {
		// Check on Shift key release (common for selection)
		if (e.key === "Shift") {
			setTimeout(() => this.checkSelection(), 50);
		}
	};

	private checkSelection(): void {
		// Check if feature is enabled
		if (!this.plugin.settings.floatingButtonEnabled) {
			this.hide();
			return;
		}

		// Check if we're in a markdown view
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			this.hide();
			return;
		}

		// Get current selection
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			this.hide();
			return;
		}

		const selectedText = selection.toString().trim();
		const minChars = this.plugin.settings.floatingButtonMinChars;

		if (selectedText.length >= minChars) {
			this.currentSelection = selectedText;
			this.show();
		} else {
			this.hide();
		}
	}

	private show(): void {
		if (this.isVisible || !this.buttonEl) return;

		this.buttonEl.style.display = "flex";
		// Trigger reflow for animation
		void this.buttonEl.offsetWidth;
		this.buttonEl.addClass("ep-floating-generate-btn--visible");
		this.isVisible = true;
	}

	private hide(): void {
		if (!this.isVisible || !this.buttonEl) return;

		this.buttonEl.removeClass("ep-floating-generate-btn--visible");
		// Wait for fade animation to complete
		setTimeout(() => {
			if (this.buttonEl && !this.isVisible) {
				this.buttonEl.style.display = "none";
			}
		}, 200);
		this.isVisible = false;
		this.currentSelection = "";
	}

	private async handleClick(): Promise<void> {
		if (!this.currentSelection) {
			new Notice("No text selected");
			return;
		}

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file");
			return;
		}

		// Store selection before hiding (hide() clears it)
		const textToGenerate = this.currentSelection;

		// Hide button immediately
		this.hide();

		// Clear browser selection
		window.getSelection()?.removeAllRanges();

		// Trigger generation
		await this.generateFromSelection(activeFile, textToGenerate);
	}

	private async generateFromSelection(file: TFile, text: string): Promise<void> {
		const directGenerate = this.plugin.settings.floatingButtonDirectGenerate;

		try {
			// Step 1: Open InstructionsModal (unless direct generate is enabled)
			let userInstructions: string | undefined;

			if (!directGenerate) {
				const { InstructionsModal } = await import("../modals/InstructionsModal");
				const instructionsModal = new InstructionsModal(this.plugin.app, {
					sourceText: text,
					sourceNoteName: file.basename,
				});

				const instructionsResult = await instructionsModal.openAndWait();
				if (instructionsResult.cancelled) {
					return;
				}
				userInstructions = instructionsResult.instructions;
			}

			new Notice("Generating flashcards...");

			// Step 2: Generate flashcards with optional user instructions
			const flashcardsMarkdown = await this.plugin.openRouterService.generateFlashcards(
				text,
				userInstructions,
				this.plugin.settings.customGeneratePrompt || undefined
			);

			if (flashcardsMarkdown.trim() === "NO_NEW_CARDS") {
				new Notice("No flashcard-worthy content found in selection.");
				return;
			}

			// Parse markdown into FlashcardItem array
			const { FlashcardParserService } = await import("../../services/flashcard/flashcard-parser.service");
			const parser = new FlashcardParserService();
			const generatedFlashcards = parser.extractFlashcards(flashcardsMarkdown);

			if (generatedFlashcards.length === 0) {
				new Notice("No flashcards were generated. Please try again.");
				return;
			}

			if (directGenerate) {
				// Direct generation: save immediately
				const flashcardsWithIds = generatedFlashcards.map((f) => ({
					id: f.id || crypto.randomUUID(),
					question: f.question,
					answer: f.answer,
				}));

				await this.plugin.flashcardManager.saveFlashcardsToSql(file, flashcardsWithIds);
				new Notice(`Created ${flashcardsWithIds.length} flashcard(s) from selection`);
			} else {
				// Step 3: Preview mode - open review modal
				const { FlashcardReviewModal } = await import("../modals/FlashcardReviewModal");
				const modal = new FlashcardReviewModal(this.plugin.app, {
					initialFlashcards: generatedFlashcards,
					sourceNoteName: file.basename,
					openRouterService: this.plugin.openRouterService,
				});

				const result = await modal.openAndWait();

				if (result.cancelled || !result.flashcards || result.flashcards.length === 0) {
					new Notice("Flashcard generation cancelled");
					return;
				}

				const flashcardsWithIds = result.flashcards.map((f) => ({
					id: f.id || crypto.randomUUID(),
					question: f.question,
					answer: f.answer,
				}));

				await this.plugin.flashcardManager.saveFlashcardsToSql(file, flashcardsWithIds);
				new Notice(`Saved ${result.flashcards.length} flashcard(s) from selection`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
