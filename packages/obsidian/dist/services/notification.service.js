import { Notice } from "obsidian";
export const NOTIFICATION_DURATION = {
    SHORT: 3000, // Quick confirmations
    NORMAL: 5000, // Standard notifications (Obsidian default)
    LONG: 8000, // Important messages
    PERSIST: 0, // Stay until dismissed
};
export class NotificationService {
    success(message, duration) {
        new Notice(message, duration !== null && duration !== void 0 ? duration : NOTIFICATION_DURATION.SHORT);
    }
    error(message, error, duration) {
        if (error) {
            console.error(`[True Recall] ${message}:`, error);
        }
        new Notice(message, duration !== null && duration !== void 0 ? duration : NOTIFICATION_DURATION.LONG);
    }
    warning(message, duration) {
        new Notice(message, duration !== null && duration !== void 0 ? duration : NOTIFICATION_DURATION.NORMAL);
    }
    info(message, duration) {
        new Notice(message, duration !== null && duration !== void 0 ? duration : NOTIFICATION_DURATION.NORMAL);
    }
    cardsCreated(count, noteName) {
        const msg = count === 1
            ? noteName
                ? `1 flashcard created in "${noteName}"`
                : "1 flashcard created"
            : noteName
                ? `${count} flashcards created in "${noteName}"`
                : `${count} flashcards created`;
        this.success(msg);
    }
    cardsCreatedWithDuplicates(created, duplicates, noteName) {
        const createdMsg = created === 1 ? "1 card" : `${created} cards`;
        const dupMsg = duplicates === 1
            ? "1 duplicate skipped"
            : `${duplicates} duplicates skipped`;
        const noteMsg = noteName ? ` in "${noteName}"` : "";
        this.warning(`${createdMsg} created${noteMsg}. ${dupMsg}.`);
    }
    allCardsDuplicates(count) {
        const msg = count === 1 ? "Card already exists" : `All ${count} cards already exist`;
        this.warning(msg);
    }
    duplicateFound(question, sourceNoteName) {
        const truncated = question.length > 50 ? `${question.slice(0, 50)}...` : question;
        const msg = sourceNoteName
            ? `Duplicate: "${truncated}" exists in "${sourceNoteName}"`
            : `Duplicate: "${truncated}" already exists`;
        this.warning(msg, NOTIFICATION_DURATION.LONG);
    }
    cardUpdated() {
        this.success("Card updated");
    }
    cardUpdatedAndMoved() {
        this.success("Card updated and moved");
    }
    cardAddedToQueue() {
        this.success("Flashcard added to queue!");
    }
    cardCopied() {
        this.success("Flashcard copied and added to queue!");
    }
    cardGradedAndMoved() {
        this.success("Card graded as Good and moved");
    }
    cardForgotten() {
        this.success("Card forgotten");
    }
    cardsForgotten(count) {
        this.success(`Forgot ${count} card${count !== 1 ? "s" : ""}`);
    }
    cardSuspended() {
        this.success("Card suspended");
    }
    cardBuried() {
        this.success("Card buried until tomorrow");
    }
    cardsBuried(count) {
        this.success(`Buried ${count} card${count !== 1 ? "s" : ""} until tomorrow`);
    }
    cardsUpdated(count) {
        const msg = count === 1 ? "Flashcard updated" : `${count} flashcards updated`;
        this.success(msg);
    }
    cardsDeleted(count) {
        const msg = count === 1 ? "Flashcard deleted" : `${count} flashcards deleted`;
        this.success(msg);
    }
    cardsDeletedWithUndo(count, onUndo) {
        const msg = count === 1 ? "Flashcard deleted." : `${count} flashcards deleted.`;
        const fragment = new DocumentFragment();
        fragment.appendText(`${msg} `);
        const link = fragment.createEl("a", { text: "Undo" });
        // eslint-disable-next-line @obsidianmd/no-direct-style-mutation -- Notice API only supports imperative DOM styling
        link.style.cursor = "pointer";
        // eslint-disable-next-line @obsidianmd/no-direct-style-mutation
        link.style.textDecoration = "underline";
        // eslint-disable-next-line @obsidianmd/no-direct-style-mutation
        link.style.fontWeight = "600";
        const notice = new Notice(fragment, NOTIFICATION_DURATION.LONG);
        link.addEventListener("click", (e) => {
            e.preventDefault();
            notice.hide();
            onUndo();
        });
    }
    cardsMoved(count, targetNote) {
        const msg = count === 1
            ? `Flashcard moved to "${targetNote}"`
            : `${count} flashcards moved to "${targetNote}"`;
        this.success(msg);
    }
    cardsStatusChanged(count, action) {
        const cardWord = count === 1 ? "card" : "cards";
        this.success(`${count} ${cardWord} ${action}`);
    }
    nothingToUndo() {
        this.info("Nothing to undo");
    }
    undoComplete(action) {
        this.success(`${action} undone`);
    }
    undoFailed(action) {
        this.error(`Failed to undo ${action.toLowerCase()}`);
    }
    noCardsAvailable(reason) {
        const msg = reason
            ? `No cards to review: ${reason}`
            : "No cards available for review";
        this.info(msg);
    }
    sessionComplete(reviewed, total) {
        this.success(`Session complete! Reviewed ${reviewed} of ${total} cards`);
    }
    generationStarted() {
        this.info("Generating flashcards...");
    }
    generationComplete(count) {
        const msg = count === 1 ? "Generated 1 flashcard" : `Generated ${count} flashcards`;
        this.success(msg);
    }
    generationFailed(error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.error(`Flashcard generation failed: ${msg}`, error);
    }
    flashcardsGeneratedAndAdded(count) {
        this.success(`${count} flashcard${count > 1 ? "s" : ""} generated and added to queue!`);
    }
    aiNotConfigured() {
        this.error("AI service not configured. Please add your API key in settings.");
    }
    fileNotFound(fileName) {
        this.error(`File not found: ${fileName}`);
    }
    noActiveFile() {
        this.warning("No active note");
    }
    fileOperationFailed(operation, error) {
        this.error(`Failed to ${operation}`, error);
    }
    operationFailed(operation, error) {
        if (error) {
            // Fallback for non-Error objects is intentional
            const msg = error instanceof Error ? error.message : String(error);
            this.error(`Failed to ${operation}: ${msg}`);
        }
        else {
            this.error(`Failed to ${operation}`);
        }
    }
    imageSaving() {
        this.info("Saving image...", NOTIFICATION_DURATION.SHORT);
    }
    imageSaved() {
        this.success("Image saved");
    }
    imageTooLarge(size, maxSize = "5MB") {
        this.error(`Image is too large (${size}). Maximum size is ${maxSize}.`);
    }
    sourceNotesSynced(synced) {
        this.success(`Synced ${synced} source note(s)`);
    }
}
// Singleton instance for convenience
let notificationService = null;
export function getNotificationService() {
    if (!notificationService) {
        notificationService = new NotificationService();
    }
    return notificationService;
}
export function notify() {
    return getNotificationService();
}
