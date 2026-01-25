/**
 * Card Actions Handler for ReviewView
 * Handles card operations: suspend, bury, move, add, copy, edit, AI generate, create zettel
 */
import { App, Notice, TFile, normalizePath } from "obsidian";
import { Rating } from "ts-fsrs";
import type { ReviewStateManager } from "../../../state";
import type { FlashcardManager, FSRSService, ReviewService, ZettelTemplateService, OpenRouterService, SqliteStoreService } from "../../../services";
import type { FSRSFlashcardItem } from "../../../types";
import type { UndoEntry } from "../review.types";
import { MoveCardModal, FlashcardEditorModal, AIGeneratorModal } from "../../modals";
import { GENERATED_NOTE_TYPES, UI_CONFIG } from "../../../constants";

/**
 * Templater plugin interface for processing templates
 */
interface TemplaterPlugin {
	templater?: {
		overwrite_file_commands: (file: TFile) => Promise<void>;
	};
}

/**
 * Dependencies required by CardActionsHandler
 */
export interface CardActionsHandlerDeps {
	app: App;
	stateManager: ReviewStateManager;
	flashcardManager: FlashcardManager;
	fsrsService: FSRSService;
	reviewService: ReviewService;
	openRouterService: OpenRouterService;
	/** SQLite store for registering source notes */
	cardStore: SqliteStoreService;
	/** Function to create ZettelTemplateService */
	createZettelTemplateService: () => ZettelTemplateService;
	settings: {
		dayStartHour: number;
		zettelFolder: string;
		zettelTemplatePath: string;
		customGeneratePrompt: string;
		openRouterApiKey: string;
	};
}

/**
 * Callbacks for actions that require view updates
 */
export interface CardActionsCallbacks {
	onUpdateSchedulingPreview: () => void;
	onRender: () => void;
	/** Called when undoing an answer - requires session persistence updates */
	onUndoAnswer: (entry: UndoEntry) => Promise<void>;
}

/**
 * CardActionsHandler encapsulates card manipulation logic
 *
 * Extracts business logic from ReviewView for:
 * - Suspend/bury operations
 * - Move card to another note
 * - Add/copy/edit flashcards
 * - Undo operations
 */
export class CardActionsHandler {
	private deps: CardActionsHandlerDeps;
	private callbacks: CardActionsCallbacks;
	private undoStack: UndoEntry[] = [];

	constructor(
		deps: CardActionsHandlerDeps,
		callbacks: CardActionsCallbacks
	) {
		this.deps = deps;
		this.callbacks = callbacks;
	}

	/**
	 * Get the undo stack (for UI display)
	 */
	getUndoStack(): ReadonlyArray<UndoEntry> {
		return this.undoStack;
	}

	/**
	 * Check if undo is available
	 */
	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/**
	 * Clear the undo stack
	 */
	clearUndoStack(): void {
		this.undoStack = [];
	}

	/**
	 * Add an undo entry (for external use, e.g., from answer handler)
	 */
	pushUndoEntry(entry: UndoEntry): void {
		this.undoStack.push(entry);
	}

	/**
	 * Pop the last undo entry
	 */
	popUndoEntry(): UndoEntry | undefined {
		return this.undoStack.pop();
	}

	/**
	 * Suspend the current card
	 * Card will be excluded from future reviews until unsuspended
	 */
	async handleSuspend(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const currentIndex = this.deps.stateManager.getState().currentIndex;

		// Store undo entry BEFORE making changes
		this.undoStack.push({
			actionType: "suspend",
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			previousIndex: currentIndex,
		});

		const updatedFsrs = { ...card.fsrs, suspended: true };

		try {
			this.deps.flashcardManager.updateCardFSRS(card.id, updatedFsrs);
		} catch (error) {
			console.error("[CardActionsHandler] Error suspending card:", error);
			new Notice("Failed to suspend card");
			// Remove the undo entry since the operation failed
			this.undoStack.pop();
			return;
		}

		// Remove from current queue
		this.deps.stateManager.removeCurrentCard();

		// Update scheduling preview for next card
		if (!this.deps.stateManager.isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		new Notice("Card suspended");
		this.callbacks.onRender();
	}

	/**
	 * Bury the current card until tomorrow
	 * Card will reappear in the next day's review
	 */
	async handleBuryCard(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const currentIndex = this.deps.stateManager.getState().currentIndex;

		// Store undo entry BEFORE making changes
		this.undoStack.push({
			actionType: "bury",
			card: { ...card },
			originalFsrs: { ...card.fsrs },
			previousIndex: currentIndex,
		});

		// Calculate tomorrow's date based on dayStartHour
		const tomorrow = this.getTomorrowDate();
		const updatedFsrs = { ...card.fsrs, buriedUntil: tomorrow.toISOString() };

		try {
			this.deps.flashcardManager.updateCardFSRS(card.id, updatedFsrs);
		} catch (error) {
			console.error("[CardActionsHandler] Error burying card:", error);
			new Notice("Failed to bury card");
			// Remove the undo entry since the operation failed
			this.undoStack.pop();
			return;
		}

		// Remove from current queue
		this.deps.stateManager.removeCurrentCard();

		// Update scheduling preview for next card
		if (!this.deps.stateManager.isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		new Notice("Card buried until tomorrow");
		this.callbacks.onRender();
	}

	/**
	 * Bury all cards from the same source note
	 * All sibling cards will reappear in the next day's review
	 */
	async handleBuryNote(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const sourceNoteName = card.sourceNoteName;
		if (!sourceNoteName) {
			// If no source note, just bury the current card
			await this.handleBuryCard();
			return;
		}

		// Find all cards from the same source note in the queue
		const queue = this.deps.stateManager.getState().queue;
		const siblingCards = queue.filter(c => c.sourceNoteName === sourceNoteName);

		const firstSibling = siblingCards[0];
		if (siblingCards.length === 0 || !firstSibling) {
			await this.handleBuryCard();
			return;
		}

		const currentIndex = this.deps.stateManager.getState().currentIndex;

		// Store undo entry for all sibling cards BEFORE making changes
		const additionalCards = siblingCards.slice(1).map(c => ({
			card: { ...c },
			originalFsrs: { ...c.fsrs },
		}));

		this.undoStack.push({
			actionType: "bury",
			card: { ...firstSibling },
			originalFsrs: { ...firstSibling.fsrs },
			previousIndex: currentIndex,
			additionalCards: additionalCards.length > 0 ? additionalCards : undefined,
		});

		// Calculate tomorrow's date based on dayStartHour
		const tomorrow = this.getTomorrowDate();
		const buriedUntil = tomorrow.toISOString();

		let buriedCount = 0;

		// Bury all sibling cards
		for (const siblingCard of siblingCards) {
			const updatedFsrs = { ...siblingCard.fsrs, buriedUntil };

			try {
				this.deps.flashcardManager.updateCardFSRS(siblingCard.id, updatedFsrs);
				buriedCount++;
			} catch (error) {
				console.error(`[CardActionsHandler] Error burying card ${siblingCard.id}:`, error);
			}

			// Remove from queue (by ID since indices change)
			this.deps.stateManager.removeCardById(siblingCard.id);
		}

		// Update scheduling preview for next card
		if (!this.deps.stateManager.isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		new Notice(`Buried ${buriedCount} card${buriedCount !== 1 ? "s" : ""} until tomorrow`);
		this.callbacks.onRender();
	}

	/**
	 * Move the current card to another note
	 */
	async handleMoveCard(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		// Open move modal with card content for backlink suggestions
		const modal = new MoveCardModal(this.deps.app, {
			cardCount: 1,
			sourceNoteName: card.sourceNoteName,
			cardQuestion: card.question,
			cardAnswer: card.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		try {
			// Grade card as "Good" before moving (updates FSRS scheduling)
			await this.deps.reviewService.gradeCard(
				card,
				Rating.Good,
				this.deps.fsrsService,
				this.deps.flashcardManager
			);

			// Move the card
			const success = await this.deps.flashcardManager.moveCard(
				card.id,
				result.targetNotePath
			);

			if (success) {
				// Remove from current queue (card no longer exists in original file)
				this.deps.stateManager.removeCurrentCard();

				// Update scheduling preview for next card
				if (!this.deps.stateManager.isComplete()) {
					this.callbacks.onUpdateSchedulingPreview();
				}

				new Notice("Card graded as Good and moved");
			}
		} catch (error) {
			console.error("[CardActionsHandler] Error moving card:", error);
			new Notice(`Failed to move card: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Add a new flashcard to the same file as the current card
	 */
	async handleAddNewFlashcard(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		// Open modal to enter question/answer
		const modal = new FlashcardEditorModal(this.deps.app, {
			mode: "add",
			currentFilePath: card.sourceNotePath || "",
			sourceNoteName: card.sourceNoteName,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		try {
			// Add flashcard with auto-generated FSRS ID
			const newCard = await this.deps.flashcardManager.addSingleFlashcard(
				result.question,
				result.answer,
				card.sourceUid
			);

			// Add new card to current session queue
			this.deps.stateManager.addCardToQueue(newCard);

			new Notice("Flashcard added to queue!");
		} catch (error) {
			console.error("[CardActionsHandler] Error adding flashcard:", error);
			new Notice(`Failed to add flashcard: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Copy current card to new flashcard
	 * Opens Add Flashcard modal with current card's Q&A pre-filled
	 */
	async handleCopyCurrentCard(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		// Open modal with pre-filled content
		const modal = new FlashcardEditorModal(this.deps.app, {
			mode: "add",
			currentFilePath: card.sourceNotePath || "",
			sourceNoteName: card.sourceNoteName,
			prefillQuestion: card.question,
			prefillAnswer: card.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		try {
			// Add flashcard with auto-generated FSRS ID
			const newCard = await this.deps.flashcardManager.addSingleFlashcard(
				result.question,
				result.answer,
				card.sourceUid
			);

			// Add new card to current session queue
			this.deps.stateManager.addCardToQueue(newCard);

			new Notice("Flashcard copied and added to queue!");
		} catch (error) {
			console.error("[CardActionsHandler] Error copying flashcard:", error);
			new Notice(`Failed to copy flashcard: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Edit the current card via modal
	 */
	async handleEditCardModal(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const modal = new FlashcardEditorModal(this.deps.app, {
			mode: "edit",
			card: card,
			currentFilePath: card.sourceNotePath || "",
			prefillQuestion: card.question,
			prefillAnswer: card.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		try {
			// Update card content
			this.deps.flashcardManager.updateCardContent(
				card.id,
				result.question,
				result.answer
			);

			// Update in state manager queue
			this.deps.stateManager.updateCurrentCardContent(
				result.question,
				result.answer
			);

			// If source was changed, move the card
			if (result.newSourceNotePath) {
				await this.deps.flashcardManager.moveCard(
					card.id,
					result.newSourceNotePath
				);
				new Notice("Card updated and moved");
			} else {
				new Notice("Card updated");
			}

			this.callbacks.onRender();
		} catch (error) {
			console.error("[CardActionsHandler] Error updating card:", error);
			new Notice(`Failed to update card: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Undo the last action (answer, bury, or suspend)
	 */
	async handleUndo(): Promise<boolean> {
		const undoEntry = this.undoStack.pop();
		if (!undoEntry) {
			new Notice("Nothing to undo");
			return false;
		}

		if (undoEntry.actionType === "bury") {
			return this.undoBury(undoEntry);
		} else if (undoEntry.actionType === "suspend") {
			return this.undoSuspend(undoEntry);
		} else {
			return this.undoAnswer(undoEntry);
		}
	}

	/**
	 * Undo a bury action
	 */
	private async undoBury(entry: UndoEntry): Promise<boolean> {
		try {
			// Restore the main card
			this.deps.flashcardManager.updateCardFSRS(entry.card.id, entry.originalFsrs);

			// Re-insert card at original position
			this.deps.stateManager.insertCardAtPosition(
				{ ...entry.card, fsrs: entry.originalFsrs },
				entry.previousIndex
			);

			// Restore additional cards (for bury note)
			if (entry.additionalCards) {
				for (const additionalCard of entry.additionalCards) {
					this.deps.flashcardManager.updateCardFSRS(
						additionalCard.card.id,
						additionalCard.originalFsrs
					);
					// Note: We don't re-insert additional cards as they might have been after current position
				}
			}

			this.callbacks.onUpdateSchedulingPreview();
			this.callbacks.onRender();
			new Notice("Bury undone");
			return true;
		} catch (error) {
			console.error("[CardActionsHandler] Error undoing bury:", error);
			new Notice("Failed to undo bury");
			return false;
		}
	}

	/**
	 * Undo a suspend action
	 */
	private async undoSuspend(entry: UndoEntry): Promise<boolean> {
		try {
			// Restore original FSRS data (with suspended: false)
			this.deps.flashcardManager.updateCardFSRS(entry.card.id, entry.originalFsrs);

			// Re-insert card at original position
			this.deps.stateManager.insertCardAtPosition(
				{ ...entry.card, fsrs: entry.originalFsrs },
				entry.previousIndex
			);

			this.callbacks.onUpdateSchedulingPreview();
			this.callbacks.onRender();
			new Notice("Suspend undone");
			return true;
		} catch (error) {
			console.error("[CardActionsHandler] Error undoing suspend:", error);
			new Notice("Failed to undo suspend");
			return false;
		}
	}

	/**
	 * Undo an answer action
	 */
	private async undoAnswer(entry: UndoEntry): Promise<boolean> {
		try {
			// Restore original FSRS data
			this.deps.flashcardManager.updateCardFSRS(entry.card.id, entry.originalFsrs);

			// Delegate session persistence updates to the view
			await this.callbacks.onUndoAnswer(entry);

			this.callbacks.onUpdateSchedulingPreview();
			this.callbacks.onRender();
			return true;
		} catch (error) {
			console.error("[CardActionsHandler] Error undoing answer:", error);
			new Notice("Failed to undo answer");
			return false;
		}
	}

	/**
	 * Calculate tomorrow's date based on dayStartHour setting
	 */
	private getTomorrowDate(): Date {
		const now = new Date();
		const tomorrow = new Date(now);

		// If we're past the day start hour, tomorrow means the next calendar day
		// If we're before the day start hour, tomorrow means today at dayStartHour
		if (now.getHours() >= this.deps.settings.dayStartHour) {
			tomorrow.setDate(tomorrow.getDate() + 1);
		}

		tomorrow.setHours(this.deps.settings.dayStartHour, 0, 0, 0);
		return tomorrow;
	}

	/**
	 * Generate flashcards using AI
	 * Associates generated cards with current card's source note and projects,
	 * or creates a new note if user requested
	 */
	async handleAIGenerateFlashcard(): Promise<void> {
		const currentCard = this.deps.stateManager.getCurrentCard();
		if (!currentCard) return;

		// Check if API key is configured
		if (!this.deps.settings.openRouterApiKey) {
			new Notice("AI service not configured. Please add your API key in settings.");
			return;
		}

		// Open AI Generator modal
		const modal = new AIGeneratorModal(this.deps.app, {
			openRouterService: this.deps.openRouterService,
			customSystemPrompt: this.deps.settings.customGeneratePrompt,
		});

		const result = await modal.openAndWait();

		if (result.cancelled || !result.flashcards || result.flashcards.length === 0) {
			return;
		}

		// Determine target source UID
		let targetSourceUid: string | undefined;
		let targetFilePath: string;

		try {
			if (result.createNewNote && result.noteType) {
				// Create a new note for the flashcards
				const noteConfig = GENERATED_NOTE_TYPES[result.noteType];

				// Generate note name
				const noteName = result.noteName || this.generateNoteName(result.noteType, result.flashcards[0]?.question);

				// Create the note
				const { uid, filePath } = await this.createSourceNoteForGeneratedCards(
					noteName,
					noteConfig.tag
				);

				targetSourceUid = uid;
				targetFilePath = filePath;

				new Notice(`Created new note: ${noteName}`);
			} else {
				// Use current card's source note
				targetSourceUid = currentCard.sourceUid;
				targetFilePath = currentCard.sourceNotePath || "";
			}

			// Save generated flashcards and add to queue
			for (const flashcard of result.flashcards) {
				const newCard = await this.deps.flashcardManager.addSingleFlashcard(
					flashcard.question,
					flashcard.answer,
					targetSourceUid
				);

				// Add to current review queue
				this.deps.stateManager.addCardToQueue(newCard);
			}

			const count = result.flashcards.length;
			new Notice(`${count} flashcard${count > 1 ? "s" : ""} generated and added to queue!`);

		} catch (error) {
			console.error("[CardActionsHandler] Error saving generated flashcards:", error);
			new Notice(`Failed to save flashcards: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Generate a note name based on note type and first flashcard question
	 */
	private generateNoteName(noteType: string, firstQuestion?: string): string {
		const config = GENERATED_NOTE_TYPES[noteType as keyof typeof GENERATED_NOTE_TYPES];
		if (!config) return `Note - ${Date.now()}`;

		if (firstQuestion) {
			// Clean up the question to use as part of the name
			const cleanQuestion = firstQuestion
				.replace(/\*\*/g, "")
				.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1")
				.replace(/#flashcard/g, "")
				.replace(/<br>/g, " ")
				.trim()
				.substring(0, 40);

			return `${config.defaultNamePrefix}${cleanQuestion}`;
		}

		return `${config.defaultNamePrefix}${Date.now()}`;
	}

	/**
	 * Create a new source note for generated flashcards
	 */
	private async createSourceNoteForGeneratedCards(
		noteName: string,
		tag: string
	): Promise<{ uid: string; filePath: string }> {
		const folderPath = normalizePath(this.deps.settings.zettelFolder || "Zettel");

		// Ensure folder exists
		if (!this.deps.app.vault.getAbstractFileByPath(folderPath)) {
			await this.deps.app.vault.createFolder(folderPath);
		}

		// Find unique file path
		let filePath = normalizePath(`${folderPath}/${noteName}.md`);
		let counter = 1;
		while (this.deps.app.vault.getAbstractFileByPath(filePath)) {
			filePath = normalizePath(`${folderPath}/${noteName} ${counter}.md`);
			counter++;
		}

		// Generate UID
		const uid = this.generateUid();

		// Create note content with frontmatter
		const content = `---
flashcard_uid: ${uid}
tags: [${tag}]
---

# ${noteName}

`;

		// Create the file
		const file = await this.deps.app.vault.create(filePath, content);

		// Register source note in SQLite (v15: only stores UID)
		this.deps.cardStore.sourceNotes.upsertSourceNote(uid);

		return { uid, filePath: file.path };
	}

	/**
	 * Generate a random 8-character hex UID
	 */
	private generateUid(): string {
		const chars = "0123456789abcdef";
		let uid = "";
		for (let i = 0; i < 8; i++) {
			uid += chars[Math.floor(Math.random() * chars.length)];
		}
		return uid;
	}

	/**
	 * Create a new zettel note from the current card
	 */
	async handleCreateZettel(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const folderPath = normalizePath(this.deps.settings.zettelFolder);

		// Ensure folder exists
		if (!this.deps.app.vault.getAbstractFileByPath(folderPath)) {
			await this.deps.app.vault.createFolder(folderPath);
		}

		// Find unique filename
		let filePath = normalizePath(`${folderPath}/${UI_CONFIG.defaultFileName}.md`);
		let counter = 1;
		while (this.deps.app.vault.getAbstractFileByPath(filePath)) {
			filePath = normalizePath(`${folderPath}/${UI_CONFIG.defaultFileName} ${counter}.md`);
			counter++;
		}

		// Generate content using template service
		const templateService = this.deps.createZettelTemplateService();
		const templatePath = this.deps.settings.zettelTemplatePath;

		// Check if template exists
		if (templatePath) {
			const templateFile = this.deps.app.vault.getAbstractFileByPath(templatePath);
			if (!templateFile) {
				new Notice(`Template not found: ${templatePath}. Using default template.`);
			}
		}

		const content = await templateService.generateContent(templatePath, card);

		// Create file
		await this.deps.app.vault.create(filePath, content);

		// Open file
		await this.deps.app.workspace.openLinkText(filePath, "", true);

		// Small delay for file-open event
		await new Promise(resolve => setTimeout(resolve, 50));

		// Process Templater syntax if installed
		const templaterPlugin = (this.deps.app as unknown as { plugins: { plugins: Record<string, TemplaterPlugin> } })
			.plugins.plugins['templater-obsidian'];
		if (templaterPlugin?.templater?.overwrite_file_commands) {
			try {
				const activeFile = this.deps.app.workspace.getActiveFile();
				if (activeFile) {
					await templaterPlugin.templater.overwrite_file_commands(activeFile);
				}
			} catch (error) {
				console.error("[CardActionsHandler] Templater processing failed:", error);
			}
		}
	}
}
