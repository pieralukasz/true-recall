/**
 * Card Actions Handler for ReviewView
 * Handles card operations: suspend, bury, move, add, copy, edit, create zettel
 */
import { App, TFile, normalizePath } from "obsidian";
import { Rating } from "ts-fsrs";
import type { ReviewStateManager } from "../../../state";
import type { FlashcardManager, FSRSService, ReviewService, ZettelTemplateService, SqliteStoreService } from "../../../services";
import type { FSRSFlashcardItem, TrueRecallSettings } from "../../../types";
import type { UndoEntry } from "../review.types";
import { MoveCardModal, SimpleFlashcardEditorModal, flashcardToMarkdown } from "../../modals";
import { notify } from "../../../services";
import { UI_CONFIG } from "../../../constants";

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
	/** SQLite store for registering source notes */
	cardStore: SqliteStoreService;
	/** Function to create ZettelTemplateService */
	createZettelTemplateService: () => ZettelTemplateService;
	settings: TrueRecallSettings;
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
			notify().operationFailed("suspend card", error);
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

		notify().cardSuspended();
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
			notify().operationFailed("bury card", error);
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

		notify().cardBuried();
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

		notify().cardsBuried(buriedCount);
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

				notify().cardGradedAndMoved();
			}
		} catch (error) {
			console.error("[CardActionsHandler] Error moving card:", error);
			notify().operationFailed("move card", error);
		}
	}

	/**
	 * Add new flashcards to the same file as the current card
	 */
	async handleAddNewFlashcard(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		// Open simple markdown editor modal
		const modal = new SimpleFlashcardEditorModal(this.deps.app, {
			mode: "add",
			currentFilePath: card.sourceNotePath || "",
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.flashcards.length === 0) return;

		try {
			// Add all parsed flashcards
			for (const flashcard of result.flashcards) {
				const newCard = await this.deps.flashcardManager.addSingleFlashcard(
					flashcard.question,
					flashcard.answer,
					card.sourceUid
				);

				// Add new card to current session queue
				this.deps.stateManager.addCardToQueue(newCard);
			}

			notify().cardsCreated(result.flashcards.length);
		} catch (error) {
			console.error("[CardActionsHandler] Error adding flashcards:", error);
			notify().operationFailed("add flashcards", error);
		}
	}

	/**
	 * Copy current card to new flashcard
	 * Opens simple markdown editor with current card's Q&A pre-filled
	 */
	async handleCopyCurrentCard(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		// Open modal with pre-filled content in markdown format
		const modal = new SimpleFlashcardEditorModal(this.deps.app, {
			mode: "add",
			currentFilePath: card.sourceNotePath || "",
			prefillContent: flashcardToMarkdown(card.question, card.answer),
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.flashcards.length === 0) return;

		try {
			// Add all parsed flashcards
			for (const flashcard of result.flashcards) {
				const newCard = await this.deps.flashcardManager.addSingleFlashcard(
					flashcard.question,
					flashcard.answer,
					card.sourceUid
				);

				// Add new card to current session queue
				this.deps.stateManager.addCardToQueue(newCard);
			}

			notify().cardsCreated(result.flashcards.length);
		} catch (error) {
			console.error("[CardActionsHandler] Error copying flashcard:", error);
			notify().operationFailed("copy flashcard", error);
		}
	}

	/**
	 * Edit the current card via modal
	 */
	async handleEditCardModal(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const modal = new SimpleFlashcardEditorModal(this.deps.app, {
			mode: "edit",
			currentFilePath: card.sourceNotePath || "",
			prefillContent: flashcardToMarkdown(card.question, card.answer),
			editCardId: card.id,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.flashcards.length === 0) return;

		try {
			// First flashcard updates the original card
			const firstFlashcard = result.flashcards[0];
			if (firstFlashcard) {
				this.deps.flashcardManager.updateCardContent(
					card.id,
					firstFlashcard.question,
					firstFlashcard.answer
				);

				// Update in state manager queue
				this.deps.stateManager.updateCurrentCardContent(
					firstFlashcard.question,
					firstFlashcard.answer
				);
			}

			// Additional flashcards (if any) are created as new cards
			if (result.flashcards.length > 1) {
				// Fallback to fsrs.sourceUid if top-level sourceUid is undefined
				const sourceUidToUse = card.sourceUid ?? card.fsrs?.sourceUid;

				for (let i = 1; i < result.flashcards.length; i++) {
					const flashcard = result.flashcards[i];
					if (flashcard) {
						const newCard = await this.deps.flashcardManager.addSingleFlashcard(
							flashcard.question,
							flashcard.answer,
							sourceUidToUse
						);
						this.deps.stateManager.addCardToQueue(newCard);
					}
				}
				notify().success(`Updated card and created ${result.flashcards.length - 1} new cards`);
			} else {
				notify().cardUpdated();
			}

			this.callbacks.onRender();
		} catch (error) {
			console.error("[CardActionsHandler] Error updating card:", error);
			notify().operationFailed("update card", error);
		}
	}

	/**
	 * Undo the last action (answer, bury, or suspend)
	 */
	async handleUndo(): Promise<boolean> {
		const undoEntry = this.undoStack.pop();
		if (!undoEntry) {
			notify().nothingToUndo();
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
			notify().undoComplete("Bury");
			return true;
		} catch (error) {
			console.error("[CardActionsHandler] Error undoing bury:", error);
			notify().undoFailed("bury");
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
			notify().undoComplete("Suspend");
			return true;
		} catch (error) {
			console.error("[CardActionsHandler] Error undoing suspend:", error);
			notify().undoFailed("suspend");
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
			notify().undoFailed("answer");
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
				notify().templateNotFound(templatePath);
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
