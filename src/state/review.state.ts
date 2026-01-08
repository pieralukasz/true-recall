/**
 * Review State Manager
 * Centralized state management for the review session
 */
import { State, Rating, type Grade } from "ts-fsrs";
import type {
    FSRSFlashcardItem,
    ReviewResult,
    ReviewSessionStats,
    ReviewSessionState,
    SchedulingPreview,
} from "../types/fsrs.types";
import { createDefaultSessionState } from "../types/fsrs.types";
import { LEARN_AHEAD_LIMIT_MINUTES } from "../constants";

/**
 * State listener type
 */
export type ReviewStateListener = (
    state: ReviewSessionState,
    prevState: ReviewSessionState
) => void;

/**
 * State selector type
 */
export type ReviewStateSelector<T> = (state: ReviewSessionState) => T;

/**
 * Edit mode state for inline editing during review
 */
export interface EditModeState {
    active: boolean;
    field: "question" | "answer" | null;
    originalQuestion: string;
    originalAnswer: string;
}

/**
 * Review State Manager
 * Manages the state of a review session with reactive updates
 */
export class ReviewStateManager {
    private state: ReviewSessionState;
    private listeners: Set<ReviewStateListener> = new Set();
    private schedulingPreview: SchedulingPreview | null = null;
    private editMode: EditModeState = {
        active: false,
        field: null,
        originalQuestion: "",
        originalAnswer: "",
    };

    constructor() {
        this.state = createDefaultSessionState();
    }

    /**
     * Get current state (immutable copy)
     */
    getState(): ReviewSessionState {
        return { ...this.state };
    }

    /**
     * Get scheduling preview for current card
     */
    getSchedulingPreview(): SchedulingPreview | null {
        return this.schedulingPreview;
    }

    /**
     * Set scheduling preview
     */
    setSchedulingPreview(preview: SchedulingPreview | null): void {
        this.schedulingPreview = preview;
    }

    /**
     * Subscribe to state changes
     * Returns unsubscribe function
     */
    subscribe(listener: ReviewStateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Subscribe to specific state changes using a selector
     */
    subscribeToSelector<T>(
        selector: ReviewStateSelector<T>,
        listener: (value: T, prevValue: T) => void
    ): () => void {
        let prevValue = selector(this.state);

        const wrappedListener: ReviewStateListener = (state) => {
            const newValue = selector(state);
            if (newValue !== prevValue) {
                const oldValue = prevValue;
                prevValue = newValue;
                listener(newValue, oldValue);
            }
        };

        this.listeners.add(wrappedListener);
        return () => this.listeners.delete(wrappedListener);
    }

    // ===== Session Control Methods =====

    /**
     * Start a new review session with the given queue
     */
    startSession(queue: FSRSFlashcardItem[]): void {
        const prevState = this.state;
        this.state = {
            isActive: true,
            queue: [...queue],
            currentIndex: 0,
            isAnswerRevealed: false,
            results: [],
            startTime: Date.now(),
            questionShownTime: Date.now(),
            stats: {
                total: queue.length,
                reviewed: 0,
                again: 0,
                hard: 0,
                good: 0,
                easy: 0,
                newCards: 0,
                learningCards: 0,
                reviewCards: 0,
                duration: 0,
            },
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    /**
     * End the current review session
     */
    endSession(): void {
        const prevState = this.state;
        this.state = {
            ...this.state,
            isActive: false,
            stats: {
                ...this.state.stats,
                duration: Date.now() - this.state.startTime,
            },
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    /**
     * Reset state to initial values
     */
    reset(): void {
        const prevState = this.state;
        this.state = createDefaultSessionState();
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    // ===== Card Navigation Methods =====

    /**
     * Get the current card being reviewed
     */
    getCurrentCard(): FSRSFlashcardItem | null {
        if (!this.state.isActive || this.state.currentIndex >= this.state.queue.length) {
            return null;
        }
        return this.state.queue[this.state.currentIndex] ?? null;
    }

    /**
     * Reveal the answer for the current card
     */
    revealAnswer(): void {
        if (!this.state.isActive || this.state.isAnswerRevealed) {
            return;
        }

        const prevState = this.state;
        this.state = {
            ...this.state,
            isAnswerRevealed: true,
        };
        this.notifyListeners(prevState);
    }

    /**
     * Hide the answer (reset reveal state)
     */
    hideAnswer(): void {
        const prevState = this.state;
        this.state = {
            ...this.state,
            isAnswerRevealed: false,
        };
        this.notifyListeners(prevState);
    }

    /**
     * Record an answer and move to next card
     * @returns true if there are more cards, false if session is complete
     */
    recordAnswer(
        rating: Grade,
        updatedCard: FSRSFlashcardItem
    ): boolean {
        if (!this.state.isActive) {
            return false;
        }

        const currentCard = this.getCurrentCard();
        if (!currentCard) {
            return false;
        }

        const responseTime = Date.now() - this.state.questionShownTime;
        const result: ReviewResult = {
            cardId: currentCard.id,
            rating,
            timestamp: Date.now(),
            responseTime,
            previousState: currentCard.fsrs.state,
            scheduledDays: currentCard.fsrs.scheduledDays,
            elapsedDays: currentCard.fsrs.lastReview
                ? Math.floor(
                      (Date.now() - new Date(currentCard.fsrs.lastReview).getTime()) /
                          (1000 * 60 * 60 * 24)
                  )
                : 0,
        };

        const prevState = this.state;

        // Update stats
        const stats = { ...this.state.stats };
        stats.reviewed++;
        if (rating === Rating.Again) stats.again++;
        else if (rating === Rating.Hard) stats.hard++;
        else if (rating === Rating.Good) stats.good++;
        else if (rating === Rating.Easy) stats.easy++;

        // Count card types
        if (currentCard.fsrs.state === State.New) stats.newCards++;
        else if (currentCard.fsrs.state === State.Learning || currentCard.fsrs.state === State.Relearning)
            stats.learningCards++;
        else if (currentCard.fsrs.state === State.Review) stats.reviewCards++;

        // Update queue with new card data
        const newQueue = [...this.state.queue];
        newQueue[this.state.currentIndex] = updatedCard;

        this.state = {
            ...this.state,
            queue: newQueue,
            results: [...this.state.results, result],
            stats,
        };

        this.notifyListeners(prevState);
        return true;
    }

    /**
     * Move to the next card
     * @returns true if there are more cards, false if session is complete
     */
    nextCard(): boolean {
        if (!this.state.isActive) {
            return false;
        }

        const nextIndex = this.state.currentIndex + 1;
        const prevState = this.state;

        // Always increment index, even if no more cards
        // This ensures isComplete() returns true when we've reviewed all cards
        this.state = {
            ...this.state,
            currentIndex: nextIndex,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);

        return nextIndex < this.state.queue.length;
    }

    /**
     * Re-queue a card (for learning cards that need to be reviewed again soon)
     */
    requeueCard(card: FSRSFlashcardItem, position?: number): void {
        const prevState = this.state;
        const newQueue = [...this.state.queue];

        if (position !== undefined) {
            newQueue.splice(position, 0, card);
        } else {
            newQueue.push(card);
        }

        // Update total count
        const stats = {
            ...this.state.stats,
            total: newQueue.length,
        };

        this.state = {
            ...this.state,
            queue: newQueue,
            stats,
        };
        this.notifyListeners(prevState);
    }

    /**
     * Undo the last answer - go back to previous card with restored data
     */
    undoLastAnswer(previousIndex: number, restoredCard: FSRSFlashcardItem): void {
        if (!this.state.isActive) {
            return;
        }

        const prevState = this.state;

        // Restore the card in the queue
        const newQueue = [...this.state.queue];
        newQueue[previousIndex] = restoredCard;

        // Remove the last result
        const newResults = this.state.results.slice(0, -1);

        // Revert stats (decrement reviewed count and rating count)
        const lastResult = this.state.results[this.state.results.length - 1];
        const stats = { ...this.state.stats };
        if (lastResult) {
            stats.reviewed = Math.max(0, stats.reviewed - 1);
            if (lastResult.rating === Rating.Again) stats.again = Math.max(0, stats.again - 1);
            else if (lastResult.rating === Rating.Hard) stats.hard = Math.max(0, stats.hard - 1);
            else if (lastResult.rating === Rating.Good) stats.good = Math.max(0, stats.good - 1);
            else if (lastResult.rating === Rating.Easy) stats.easy = Math.max(0, stats.easy - 1);

            // Revert card type counts
            if (lastResult.previousState === State.New) stats.newCards = Math.max(0, stats.newCards - 1);
            else if (lastResult.previousState === State.Learning || lastResult.previousState === State.Relearning)
                stats.learningCards = Math.max(0, stats.learningCards - 1);
            else if (lastResult.previousState === State.Review) stats.reviewCards = Math.max(0, stats.reviewCards - 1);
        }

        this.state = {
            ...this.state,
            queue: newQueue,
            currentIndex: previousIndex,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
            results: newResults,
            stats,
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    // ===== Progress & Stats Methods =====

    /**
     * Get current progress
     */
    getProgress(): { current: number; total: number; percentage: number } {
        const current = Math.min(this.state.currentIndex + 1, this.state.queue.length);
        const total = this.state.queue.length;
        const percentage = total > 0 ? (current / total) * 100 : 0;
        return { current, total, percentage };
    }

    /**
     * Get session statistics
     */
    getStats(): ReviewSessionStats {
        return {
            ...this.state.stats,
            duration: this.state.isActive
                ? Date.now() - this.state.startTime
                : this.state.stats.duration,
        };
    }

    /**
     * Check if session is active
     */
    isActive(): boolean {
        return this.state.isActive;
    }

    /**
     * Check if answer is revealed
     */
    isAnswerRevealed(): boolean {
        return this.state.isAnswerRevealed;
    }

    /**
     * Check if session is complete (all cards reviewed)
     */
    isComplete(): boolean {
        return (
            this.state.isActive &&
            this.state.currentIndex >= this.state.queue.length
        );
    }

    /**
     * Get remaining cards count
     */
    getRemainingCount(): number {
        return Math.max(0, this.state.queue.length - this.state.currentIndex);
    }

    /**
     * Check if a card is due now (or within learn ahead limit)
     */
    isCardDueNow(card: FSRSFlashcardItem): boolean {
        const dueDate = new Date(card.fsrs.due);
        const now = new Date();
        const learnAheadTime = new Date(
            now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000
        );
        return dueDate <= learnAheadTime;
    }

    /**
     * Get pending learning cards (not yet due) from remaining queue
     */
    getPendingLearningCards(): FSRSFlashcardItem[] {
        const remaining = this.state.queue.slice(this.state.currentIndex);
        return remaining.filter((card) => {
            const isLearning = card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning;
            return isLearning && !this.isCardDueNow(card);
        });
    }

    /**
     * Get time until next learning card is due (in ms)
     * Returns 0 if no pending learning cards or card is already due
     */
    getTimeUntilNextDue(): number {
        const pending = this.getPendingLearningCards();
        if (pending.length === 0) return 0;

        // Find the soonest due card
        const now = Date.now();
        let soonest = Infinity;

        for (const card of pending) {
            const dueTime = new Date(card.fsrs.due).getTime();
            const timeUntil = dueTime - now;
            if (timeUntil > 0 && timeUntil < soonest) {
                soonest = timeUntil;
            }
        }

        return soonest === Infinity ? 0 : soonest;
    }

    /**
     * Check if we're in "waiting for learning cards" state
     * This is true when:
     * - Session is active
     * - Current card exists but is not due yet
     * - All previous cards have been reviewed
     */
    isWaitingForLearningCards(): boolean {
        if (!this.state.isActive) return false;

        const currentCard = this.getCurrentCard();
        if (!currentCard) return false;

        // Check if current card is a learning/relearning card that's not due yet
        const isLearning = currentCard.fsrs.state === State.Learning || currentCard.fsrs.state === State.Relearning;
        if (!isLearning) return false;

        return !this.isCardDueNow(currentCard);
    }

    /**
     * Remove current card from queue (for suspend/delete)
     */
    removeCurrentCard(): void {
        if (!this.state.isActive) {
            return;
        }

        const prevState = this.state;
        const newQueue = [...this.state.queue];
        newQueue.splice(this.state.currentIndex, 1);

        this.state = {
            ...this.state,
            queue: newQueue,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
            stats: {
                ...this.state.stats,
                total: newQueue.length,
            },
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    /**
     * Remove a specific card from queue by ID (for bury note)
     */
    removeCardById(cardId: string): void {
        if (!this.state.isActive) {
            return;
        }

        const prevState = this.state;
        const cardIndex = this.state.queue.findIndex(c => c.id === cardId);

        if (cardIndex === -1) {
            return; // Card not found
        }

        const newQueue = [...this.state.queue];
        newQueue.splice(cardIndex, 1);

        // Adjust currentIndex if needed
        let newIndex = this.state.currentIndex;
        if (cardIndex < this.state.currentIndex) {
            newIndex = Math.max(0, newIndex - 1);
        } else if (cardIndex === this.state.currentIndex && newIndex >= newQueue.length) {
            newIndex = Math.max(0, newQueue.length - 1);
        }

        this.state = {
            ...this.state,
            queue: newQueue,
            currentIndex: newIndex,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
            stats: {
                ...this.state.stats,
                total: newQueue.length,
            },
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    /**
     * Insert a card at a specific position in the queue (for undo bury)
     */
    insertCardAtPosition(card: FSRSFlashcardItem, position: number): void {
        if (!this.state.isActive) {
            return;
        }

        const prevState = this.state;
        const newQueue = [...this.state.queue];

        // Clamp position to valid range
        const clampedPosition = Math.max(0, Math.min(position, newQueue.length));
        newQueue.splice(clampedPosition, 0, card);

        this.state = {
            ...this.state,
            queue: newQueue,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
            stats: {
                ...this.state.stats,
                total: newQueue.length,
            },
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    // ===== Edit Mode Methods =====

    /**
     * Get current edit mode state
     */
    getEditState(): EditModeState {
        return { ...this.editMode };
    }

    /**
     * Start editing a field (question or answer)
     */
    startEdit(field: "question" | "answer"): void {
        const card = this.getCurrentCard();
        if (!card) return;

        this.editMode = {
            active: true,
            field,
            originalQuestion: card.question,
            originalAnswer: card.answer,
        };
    }

    /**
     * Cancel edit mode without saving
     */
    cancelEdit(): void {
        this.editMode = {
            active: false,
            field: null,
            originalQuestion: "",
            originalAnswer: "",
        };
    }

    /**
     * Check if currently in edit mode
     */
    isEditing(): boolean {
        return this.editMode.active;
    }

    /**
     * Update current card's content in the queue (after saving to file)
     */
    updateCurrentCardContent(newQuestion: string, newAnswer: string): void {
        const card = this.getCurrentCard();
        if (!card) return;

        const newQueue = [...this.state.queue];
        const updatedCard = {
            ...card,
            question: newQuestion,
            answer: newAnswer,
        };
        newQueue[this.state.currentIndex] = updatedCard;

        const prevState = this.state;
        this.state = {
            ...this.state,
            queue: newQueue,
        };
        this.notifyListeners(prevState);
    }

    // ===== Private Methods =====

    private notifyListeners(prevState: ReviewSessionState): void {
        const currentState = this.state;
        this.listeners.forEach((listener) => {
            try {
                listener(currentState, prevState);
            } catch (error) {
                console.error("Error in review state listener:", error);
            }
        });
    }
}

/**
 * Create a new ReviewStateManager instance
 */
export function createReviewStateManager(): ReviewStateManager {
    return new ReviewStateManager();
}
