/**
 * Card Actions Handler for ReviewView
 * Handles card operations: suspend, bury, move, add, copy, edit, create zettel
 */
import { App, TFile, normalizePath } from "obsidian";
import { Rating } from "ts-fsrs";
import type { ReviewStateManager } from "../../../state";
import type { FlashcardManager, FSRSService, ReviewService, ZettelTemplateService, SqliteStoreService } from "../../../services";
import type { FSRSFlashcardItem, TrueRecallSettings } from "../../../types";
import { MoveCardModal, SimpleFlashcardEditorModal, flashcardToMarkdown } from "../../modals";
import { notify } from "../../../services";
import { UI_CONFIG } from "../../../constants";
import type TrueRecallPlugin from "../../../main";

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
	/** Plugin instance for accessing AgentService */
	plugin: TrueRecallPlugin;
}

/**
 * Callbacks for actions that require view updates
 */
export interface CardActionsCallbacks {
	onUpdateSchedulingPreview: () => void;
	onRender: () => void;
}

/**
 * CardActionsHandler encapsulates card manipulation logic
 *
 * Extracts business logic from ReviewView for:
 * - Suspend/bury operations
 * - Move card to another note
 * - Add/copy/edit flashcards
 * - Undo operations (delegated to global UndoService)
 */
export class CardActionsHandler {
	private deps: CardActionsHandlerDeps;
	private callbacks: CardActionsCallbacks;

	constructor(
		deps: CardActionsHandlerDeps,
		callbacks: CardActionsCallbacks
	) {
		this.deps = deps;
		this.callbacks = callbacks;
	}

	/**
	 * Check if undo is available (delegated to global UndoService)
	 */
	canUndo(): boolean {
		return this.deps.plugin.undoService?.canUndo() ?? false;
	}

	/**
	 * Suspend the current card
	 * Card will be excluded from future reviews until unsuspended
	 */
	async handleSuspend(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const currentIndex = this.deps.stateManager.getState().currentIndex;
		const undoService = this.deps.plugin.undoService;

		const updatedFsrs = { ...card.fsrs, suspended: true };

		try {
			this.deps.flashcardManager.updateCardFSRS(card.id, updatedFsrs);
		} catch (error) {
			console.error("[CardActionsHandler] Error suspending card:", error);
			notify().operationFailed("suspend card", error);
			return;
		}

		// Push undo entry AFTER successful operation
		undoService?.push({
			id: crypto.randomUUID(),
			actionType: "suspend",
			description: "Suspend card",
			timestamp: Date.now(),
			payload: {
				type: "suspend",
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
			},
		});

		// Remove from current queue
		this.deps.stateManager.removeCurrentCard();

		// Update scheduling preview for next card
		if (!this.deps.stateManager.isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		notify().cardSuspended();
		// Note: render triggered by removeCurrentCard() → notifyListeners()
	}

	/**
	 * Bury the current card until tomorrow
	 * Card will reappear in the next day's review
	 */
	async handleBuryCard(): Promise<void> {
		const card = this.deps.stateManager.getCurrentCard();
		if (!card) return;

		const currentIndex = this.deps.stateManager.getState().currentIndex;
		const undoService = this.deps.plugin.undoService;

		// Calculate tomorrow's date based on dayStartHour
		const tomorrow = this.getTomorrowDate();
		const updatedFsrs = { ...card.fsrs, buriedUntil: tomorrow.toISOString() };

		try {
			this.deps.flashcardManager.updateCardFSRS(card.id, updatedFsrs);
		} catch (error) {
			console.error("[CardActionsHandler] Error burying card:", error);
			notify().operationFailed("bury card", error);
			return;
		}

		// Push undo entry AFTER successful operation
		undoService?.push({
			id: crypto.randomUUID(),
			actionType: "bury",
			description: "Bury card",
			timestamp: Date.now(),
			payload: {
				type: "bury",
				card: { ...card },
				originalFsrs: { ...card.fsrs },
				previousIndex: currentIndex,
			},
		});

		// Remove from current queue
		this.deps.stateManager.removeCurrentCard();

		// Update scheduling preview for next card
		if (!this.deps.stateManager.isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		notify().cardBuried();
		// Note: render triggered by removeCurrentCard() → notifyListeners()
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
		const undoService = this.deps.plugin.undoService;

		// Calculate tomorrow's date based on dayStartHour
		const tomorrow = this.getTomorrowDate();
		const buriedUntil = tomorrow.toISOString();

		// Capture undo data for all sibling cards BEFORE making changes
		const additionalCards = siblingCards.slice(1).map(c => ({
			card: { ...c },
			originalFsrs: { ...c.fsrs },
		}));

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

		// Push undo entry AFTER successful operations
		if (buriedCount > 0) {
			undoService?.push({
				id: crypto.randomUUID(),
				actionType: "bury",
				description: `Bury ${buriedCount} cards`,
				timestamp: Date.now(),
				payload: {
					type: "bury",
					card: { ...firstSibling },
					originalFsrs: { ...firstSibling.fsrs },
					previousIndex: currentIndex,
					additionalCards: additionalCards.length > 0 ? additionalCards : undefined,
				},
			});
		}

		// Update scheduling preview for next card
		if (!this.deps.stateManager.isComplete()) {
			this.callbacks.onUpdateSchedulingPreview();
		}

		notify().cardsBuried(buriedCount);
		// Note: render triggered by removeCardById() → notifyListeners()
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
			// Add all parsed flashcards directly using the current card's sourceUid
			for (const flashcard of result.flashcards) {
				const newCard = await this.deps.flashcardManager.addSingleFlashcard(
					flashcard.question,
					flashcard.answer,
					card.sourceUid
				);

				// Add new card to current session queue
				this.deps.stateManager.addCardToQueue(newCard);
			}

			const noteName = card.sourceNotePath?.split("/").pop()?.replace(/\.md$/, "");
			notify().cardsCreated(result.flashcards.length, noteName);
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
			// Add all parsed flashcards directly using the current card's sourceUid
			for (const flashcard of result.flashcards) {
				const newCard = await this.deps.flashcardManager.addSingleFlashcard(
					flashcard.question,
					flashcard.answer,
					card.sourceUid
				);

				// Add new card to current session queue
				this.deps.stateManager.addCardToQueue(newCard);
			}

			const noteName = card.sourceNotePath?.split("/").pop()?.replace(/\.md$/, "");
			notify().cardsCreated(result.flashcards.length, noteName);
		} catch (error) {
			console.error("[CardActionsHandler] Error copying flashcard:", error);
			notify().operationFailed("copy flashcard", error);
		}
	}

	/**
	 * Edit the current card via modal
	 * Uses direct FlashcardManager calls (no undo support for simplicity)
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
			// First flashcard updates the original card directly
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

			// Additional flashcards (if any) are created as new cards directly
			if (result.flashcards.length > 1) {
				for (let i = 1; i < result.flashcards.length; i++) {
					const flashcard = result.flashcards[i];
					if (flashcard) {
						const newCard = await this.deps.flashcardManager.addSingleFlashcard(
							flashcard.question,
							flashcard.answer,
							card.sourceUid
						);

						// Add new card to current session queue
						this.deps.stateManager.addCardToQueue(newCard);
					}
				}
				notify().success(`Updated card and created ${result.flashcards.length - 1} new cards`);
			} else {
				notify().cardUpdated();
			}
			// Note: render triggered by updateCurrentCardContent/addCardToQueue → notifyListeners()
		} catch (error) {
			console.error("[CardActionsHandler] Error updating card:", error);
			notify().operationFailed("update card", error);
		}
	}

	/**
	 * Undo the last action (delegated to global UndoService)
	 * All undo logic is now unified in UndoService for proper LIFO ordering
	 */
	async handleUndo(): Promise<boolean> {
		const undoService = this.deps.plugin.undoService;
		if (!undoService?.canUndo()) {
			notify().nothingToUndo();
			return false;
		}

		const success = await undoService.undo();
		// Note: render triggered by UndoService via insertCardAtPosition/undoLastAnswer → notifyListeners()
		return success;
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
