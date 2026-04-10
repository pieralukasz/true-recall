import { Notice } from "obsidian";

export const NOTIFICATION_DURATION = {
	SHORT: 3000, // Quick confirmations
	NORMAL: 5000, // Standard notifications (Obsidian default)
	LONG: 8000, // Important messages
	PERSIST: 0, // Stay until dismissed
} as const;

class NotificationService {
	success(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.SHORT);
	}

	error(message: string, error?: unknown, duration?: number): void {
		if (error) {
			console.error(`[True Recall] ${message}:`, error);
		}
		new Notice(message, duration ?? NOTIFICATION_DURATION.LONG);
	}

	warning(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.NORMAL);
	}

	info(message: string, duration?: number): void {
		new Notice(message, duration ?? NOTIFICATION_DURATION.NORMAL);
	}

	cardsCreated(count: number, noteName?: string): void {
		const msg =
			count === 1
				? noteName
					? `1 flashcard created in "${noteName}"`
					: "1 flashcard created"
				: noteName
					? `${count} flashcards created in "${noteName}"`
					: `${count} flashcards created`;
		this.success(msg);
	}

	cardsCreatedWithDuplicates(
		created: number,
		duplicates: number,
		noteName?: string,
	): void {
		const createdMsg = created === 1 ? "1 card" : `${created} cards`;
		const dupMsg =
			duplicates === 1
				? "1 duplicate skipped"
				: `${duplicates} duplicates skipped`;
		const noteMsg = noteName ? ` in "${noteName}"` : "";
		this.warning(`${createdMsg} created${noteMsg}. ${dupMsg}.`);
	}

	allCardsDuplicates(count: number): void {
		const msg =
			count === 1 ? "Card already exists" : `All ${count} cards already exist`;
		this.warning(msg);
	}

	duplicateFound(question: string, sourceNoteName?: string): void {
		const truncated =
			question.length > 50 ? `${question.slice(0, 50)}...` : question;
		const msg = sourceNoteName
			? `Duplicate: "${truncated}" exists in "${sourceNoteName}"`
			: `Duplicate: "${truncated}" already exists`;
		this.warning(msg, NOTIFICATION_DURATION.LONG);
	}

	cardUpdated(): void {
		this.success("Card updated");
	}

	cardUpdatedAndMoved(): void {
		this.success("Card updated and moved");
	}

	cardAddedToQueue(): void {
		this.success("Flashcard added to queue!");
	}

	cardCopied(): void {
		this.success("Flashcard copied and added to queue!");
	}

	cardGradedAndMoved(): void {
		this.success("Card graded as Good and moved");
	}

	cardForgotten(): void {
		this.success("Card forgotten");
	}

	cardsForgotten(count: number): void {
		this.success(`Forgot ${count} card${count !== 1 ? "s" : ""}`);
	}

	cardSuspended(): void {
		this.success("Card suspended");
	}

	cardBuried(): void {
		this.success("Card buried until tomorrow");
	}

	cardsBuried(count: number): void {
		this.success(
			`Buried ${count} card${count !== 1 ? "s" : ""} until tomorrow`,
		);
	}

	cardsUpdated(count: number): void {
		const msg =
			count === 1 ? "Flashcard updated" : `${count} flashcards updated`;
		this.success(msg);
	}

	cardsDeleted(count: number): void {
		const msg =
			count === 1 ? "Flashcard deleted" : `${count} flashcards deleted`;
		this.success(msg);
	}

	cardsDeletedWithUndo(count: number, onUndo: () => void): void {
		const msg =
			count === 1 ? "Flashcard deleted." : `${count} flashcards deleted.`;
		const fragment = new DocumentFragment();
		fragment.appendText(`${msg} `);
		const link = fragment.createEl("a", { text: "Undo" });
		// eslint-disable-next-line @obsidianmd/no-direct-style-mutation -- Notice API only supports imperative DOM styling
		link.style.cursor = "pointer";
		// eslint-disable-next-line @obsidianmd/no-direct-style-mutation -- Notice API only supports imperative DOM styling
		link.style.textDecoration = "underline";
		// eslint-disable-next-line @obsidianmd/no-direct-style-mutation -- Notice API only supports imperative DOM styling
		link.style.fontWeight = "600";
		const notice = new Notice(fragment, NOTIFICATION_DURATION.LONG);
		link.addEventListener("click", (e) => {
			e.preventDefault();
			notice.hide();
			onUndo();
		});
	}

	cardsMoved(count: number, targetNote: string): void {
		const msg =
			count === 1
				? `Flashcard moved to "${targetNote}"`
				: `${count} flashcards moved to "${targetNote}"`;
		this.success(msg);
	}

	cardsStatusChanged(
		count: number,
		action: "suspended" | "buried" | "unburied",
	): void {
		const cardWord = count === 1 ? "card" : "cards";
		this.success(`${count} ${cardWord} ${action}`);
	}

	nothingToUndo(): void {
		this.info("Nothing to undo");
	}

	undoComplete(action: string): void {
		this.success(`${action} undone`);
	}

	undoFailed(action: string): void {
		this.error(`Failed to undo ${action.toLowerCase()}`);
	}

	nothingToRedo(): void {
		this.info("Nothing to redo");
	}

	redoComplete(action: string): void {
		this.success(`${action} redone`);
	}

	redoFailed(action: string): void {
		this.error(`Failed to redo ${action.toLowerCase()}`);
	}

	noCardsAvailable(reason?: string): void {
		const msg = reason
			? `No cards to review: ${reason}`
			: "No cards available for review";
		this.info(msg);
	}

	sessionComplete(reviewed: number, total: number): void {
		this.success(`Session complete! Reviewed ${reviewed} of ${total} cards`);
	}

	generationStarted(): void {
		this.info("Generating flashcards...");
	}

	generationComplete(count: number): void {
		const msg =
			count === 1 ? "Generated 1 flashcard" : `Generated ${count} flashcards`;
		this.success(msg);
	}

	generationFailed(error: unknown): void {
		const msg = error instanceof Error ? error.message : String(error);
		this.error(`Flashcard generation failed: ${msg}`, error);
	}

	flashcardsGeneratedAndAdded(count: number): void {
		this.success(
			`${count} flashcard${count > 1 ? "s" : ""} generated and added to queue!`,
		);
	}

	aiNotConfigured(): void {
		this.error(
			"AI service not configured. Please add your API key in settings.",
		);
	}

	fileNotFound(fileName: string): void {
		this.error(`File not found: ${fileName}`);
	}

	noActiveFile(): void {
		this.warning("No active note");
	}

	fileOperationFailed(operation: string, error?: unknown): void {
		this.error(`Failed to ${operation}`, error);
	}

	operationFailed(operation: string, error?: unknown): void {
		if (error) {
			// Fallback for non-Error objects is intentional
			const msg = error instanceof Error ? error.message : String(error);
			this.error(`Failed to ${operation}: ${msg}`);
		} else {
			this.error(`Failed to ${operation}`);
		}
	}

	imageSaving(): void {
		this.info("Saving image...", NOTIFICATION_DURATION.SHORT);
	}

	imageSaved(): void {
		this.success("Image saved");
	}

	imageTooLarge(size: string, maxSize: string = "5MB"): void {
		this.error(`Image is too large (${size}). Maximum size is ${maxSize}.`);
	}

	sourceNotesSynced(synced: number): void {
		this.success(`Synced ${synced} source note(s)`);
	}
}

// Singleton instance for convenience
let notificationService: NotificationService | null = null;

function getNotificationService(): NotificationService {
	if (!notificationService) {
		notificationService = new NotificationService();
	}
	return notificationService;
}

export function notify(): NotificationService {
	return getNotificationService();
}
