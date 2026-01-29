/**
 * NotificationService
 * Centralized notification handling for the plugin
 *
 * Benefits:
 * - Consistent notification styling and behavior
 * - Easy to customize notification duration
 * - Centralized place to add logging if needed
 * - Type-safe notification methods for common actions
 */
import { Notice } from "obsidian";

/**
 * Default notification durations (in milliseconds)
 */
export const NOTIFICATION_DURATION = {
	SHORT: 3000,    // Quick confirmations
	NORMAL: 5000,   // Standard notifications (Obsidian default)
	LONG: 8000,     // Important messages
	PERSIST: 0,     // Stay until dismissed
} as const;

/**
 * Centralized notification service
 * Replaces direct `new Notice()` calls throughout the codebase
 */
export class NotificationService {
	/**
	 * Show a success notification
	 *
	 * @param message - The success message
	 * @param duration - Optional duration in ms
	 */
	success(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.SHORT);
	}

	/**
	 * Show an error notification
	 *
	 * @param message - The error message
	 * @param error - Optional error object for logging
	 * @param duration - Optional duration in ms
	 */
	error(message: string, error?: unknown, duration?: number): void {
		if (error) {
			console.error(`[True Recall] ${message}:`, error);
		}
		new Notice(message, duration ?? NOTIFICATION_DURATION.LONG);
	}

	/**
	 * Show a warning notification
	 *
	 * @param message - The warning message
	 * @param duration - Optional duration in ms
	 */
	warning(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.NORMAL);
	}

	/**
	 * Show an info notification
	 *
	 * @param message - The info message
	 * @param duration - Optional duration in ms
	 */
	info(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.NORMAL);
	}

	// ===== Card Action Notifications =====

	/**
	 * Show notification for card creation
	 *
	 * @param count - Number of cards created
	 */
	cardsCreated(count: number): void {
		const msg = count === 1
			? "1 flashcard created"
			: `${count} flashcards created`;
		this.success(msg);
	}

	/**
	 * Show notification for single card update
	 */
	cardUpdated(): void {
		this.success("Card updated");
	}

	/**
	 * Show notification for card update with move
	 */
	cardUpdatedAndMoved(): void {
		this.success("Card updated and moved");
	}

	/**
	 * Show notification for card added to queue
	 */
	cardAddedToQueue(): void {
		this.success("Flashcard added to queue!");
	}

	/**
	 * Show notification for card copied
	 */
	cardCopied(): void {
		this.success("Flashcard copied and added to queue!");
	}

	/**
	 * Show notification for card graded and moved
	 */
	cardGradedAndMoved(): void {
		this.success("Card graded as Good and moved");
	}

	/**
	 * Show notification for card suspended
	 */
	cardSuspended(): void {
		this.success("Card suspended");
	}

	/**
	 * Show notification for card buried
	 */
	cardBuried(): void {
		this.success("Card buried until tomorrow");
	}

	/**
	 * Show notification for multiple cards buried
	 */
	cardsBuried(count: number): void {
		this.success(`Buried ${count} card${count !== 1 ? "s" : ""} until tomorrow`);
	}

	/**
	 * Show notification for card update
	 *
	 * @param count - Number of cards updated
	 */
	cardsUpdated(count: number): void {
		const msg = count === 1
			? "Flashcard updated"
			: `${count} flashcards updated`;
		this.success(msg);
	}

	/**
	 * Show notification for card deletion
	 *
	 * @param count - Number of cards deleted
	 */
	cardsDeleted(count: number): void {
		const msg = count === 1
			? "Flashcard deleted"
			: `${count} flashcards deleted`;
		this.success(msg);
	}

	/**
	 * Show notification for card move
	 *
	 * @param count - Number of cards moved
	 * @param targetNote - Target note name
	 */
	cardsMoved(count: number, targetNote: string): void {
		const msg = count === 1
			? `Flashcard moved to "${targetNote}"`
			: `${count} flashcards moved to "${targetNote}"`;
		this.success(msg);
	}

	/**
	 * Show notification for cards suspended/buried
	 *
	 * @param count - Number of cards affected
	 * @param action - "suspended" or "buried"
	 */
	cardsStatusChanged(count: number, action: "suspended" | "buried" | "unburied"): void {
		const cardWord = count === 1 ? "card" : "cards";
		this.success(`${count} ${cardWord} ${action}`);
	}

	// ===== Undo Notifications =====

	/**
	 * Show notification when there's nothing to undo
	 */
	nothingToUndo(): void {
		this.info("Nothing to undo");
	}

	/**
	 * Show notification for successful undo
	 */
	undoComplete(action: string): void {
		this.success(`${action} undone`);
	}

	/**
	 * Show notification for failed undo
	 */
	undoFailed(action: string): void {
		this.error(`Failed to undo ${action.toLowerCase()}`);
	}

	// ===== Session Notifications =====

	/**
	 * Show notification when no cards are available for review
	 *
	 * @param reason - Optional reason (e.g., "all cards reviewed")
	 */
	noCardsAvailable(reason?: string): void {
		const msg = reason
			? `No cards to review: ${reason}`
			: "No cards available for review";
		this.info(msg);
	}

	/**
	 * Show notification for session completion
	 *
	 * @param reviewed - Number of cards reviewed
	 * @param total - Total cards in session
	 */
	sessionComplete(reviewed: number, total: number): void {
		this.success(`Session complete! Reviewed ${reviewed} of ${total} cards`);
	}

	// ===== AI Notifications =====

	/**
	 * Show notification for AI generation start
	 */
	generationStarted(): void {
		this.info("Generating flashcards...");
	}

	/**
	 * Show notification for AI generation complete
	 *
	 * @param count - Number of flashcards generated
	 */
	generationComplete(count: number): void {
		const msg = count === 1
			? "Generated 1 flashcard"
			: `Generated ${count} flashcards`;
		this.success(msg);
	}

	/**
	 * Show notification for AI generation error
	 *
	 * @param error - The error that occurred
	 */
	generationFailed(error: unknown): void {
		const msg = error instanceof Error ? error.message : String(error);
		this.error(`Flashcard generation failed: ${msg}`, error);
	}

	/**
	 * Show notification for flashcards generated and added to queue
	 */
	flashcardsGeneratedAndAdded(count: number): void {
		this.success(`${count} flashcard${count > 1 ? "s" : ""} generated and added to queue!`);
	}

	/**
	 * Show notification when AI service is not configured
	 */
	aiNotConfigured(): void {
		this.error("AI service not configured. Please add your API key in settings.");
	}

	/**
	 * Show notification for zettel/note created
	 */
	noteCreated(noteName: string): void {
		this.success(`Created new note: ${noteName}`);
	}

	/**
	 * Show notification when template is not found
	 */
	templateNotFound(templatePath: string): void {
		this.warning(`Template not found: ${templatePath}. Using default template.`);
	}

	// ===== File Operation Notifications =====

	/**
	 * Show notification for file not found
	 *
	 * @param fileName - Name of the file
	 */
	fileNotFound(fileName: string): void {
		this.error(`File not found: ${fileName}`);
	}

	/**
	 * Show notification for no active file
	 */
	noActiveFile(): void {
		this.warning("No active note");
	}

	/**
	 * Show notification for file operation error
	 *
	 * @param operation - The operation that failed
	 * @param error - The error that occurred
	 */
	fileOperationFailed(operation: string, error?: unknown): void {
		this.error(`Failed to ${operation}`, error);
	}

	/**
	 * Show notification for a failed operation with error message
	 *
	 * @param operation - The operation that failed (e.g., "suspend card", "move card")
	 * @param error - Optional error for detailed message
	 */
	operationFailed(operation: string, error?: unknown): void {
		if (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.error(`Failed to ${operation}: ${msg}`, error);
		} else {
			this.error(`Failed to ${operation}`);
		}
	}

	// ===== Image Notifications =====

	/**
	 * Show notification for image save
	 */
	imageSaving(): void {
		this.info("Saving image...", NOTIFICATION_DURATION.SHORT);
	}

	/**
	 * Show notification for image saved
	 */
	imageSaved(): void {
		this.success("Image saved");
	}

	/**
	 * Show notification for image too large
	 *
	 * @param size - Current size string (e.g., "6.5MB")
	 * @param maxSize - Maximum allowed size (e.g., "5MB")
	 */
	imageTooLarge(size: string, maxSize: string = "5MB"): void {
		this.error(`Image is too large (${size}). Maximum size is ${maxSize}.`);
	}

	// ===== Sync Notifications =====

	/**
	 * Show notification for source note sync
	 *
	 * @param synced - Number of notes synced
	 * @param orphaned - Number of orphaned notes removed
	 * @param orphanedCards - Number of cards detached
	 */
	sourceNotesSynced(synced: number, orphaned: number = 0, orphanedCards: number = 0): void {
		let msg = `Synced ${synced} source note(s)`;
		if (orphaned > 0) {
			msg += `. Removed ${orphaned} orphaned entries`;
			if (orphanedCards > 0) {
				msg += ` (${orphanedCards} cards detached)`;
			}
		}
		this.success(msg);
	}
}

// Singleton instance for convenience
let notificationService: NotificationService | null = null;

/**
 * Get the notification service singleton
 */
export function getNotificationService(): NotificationService {
	if (!notificationService) {
		notificationService = new NotificationService();
	}
	return notificationService;
}

/**
 * Shorthand for getting notification service
 * Usage: notify().success("Done!")
 */
export function notify(): NotificationService {
	return getNotificationService();
}
