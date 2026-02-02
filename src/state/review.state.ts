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
} from "../types";
import { createDefaultSessionState } from "../types";
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
 * Badge counts for remaining cards by type
 */
export interface BadgeCounts {
    new: number;
    learning: number;
    due: number;
}

/**
 * Session phase - explicit state machine for review flow
 * Replaces multiple boolean checks with a single discriminated union
 */
export type SessionPhase =
    | { type: "idle" }
    | { type: "active"; card: FSRSFlashcardItem }
    | { type: "waiting"; timeUntilDue: number }
    | { type: "complete"; stats: ReviewSessionStats };

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
    // Cached badge counts - O(1) access, updated incrementally
    private cachedBadgeCounts: BadgeCounts = { new: 0, learning: 0, due: 0 };

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
     * Get badge counts for remaining queue - O(1) cached access
     * Counts are computed once at session start and updated incrementally
     */
    getBadgeCounts(): BadgeCounts {
        return { ...this.cachedBadgeCounts };
    }

    /**
     * Compute badge counts from scratch - O(N), called only at session start
     */
    private computeBadgeCounts(queue: FSRSFlashcardItem[], startIndex: number): BadgeCounts {
        const counts: BadgeCounts = { new: 0, learning: 0, due: 0 };
        for (let i = startIndex; i < queue.length; i++) {
            const card = queue[i];
            if (card) {
                const badgeType = this.getBadgeTypeForState(card.fsrs.state);
                counts[badgeType]++;
            }
        }
        return counts;
    }

    /**
     * Get badge type for a card state
     */
    private getBadgeTypeForState(cardState: State): keyof BadgeCounts {
        if (cardState === State.New) return "new";
        if (cardState === State.Learning || cardState === State.Relearning) return "learning";
        return "due";
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
        // Compute initial badge counts - O(N) once at session start
        this.cachedBadgeCounts = this.computeBadgeCounts(queue, 0);
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
        this.cachedBadgeCounts = { new: 0, learning: 0, due: 0 };
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

        // Update queue with new card data
        const newQueue = [...this.state.queue];
        newQueue[this.state.currentIndex] = updatedCard;

        this.state = {
            ...this.state,
            queue: newQueue,
            results: [...this.state.results, result],
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

        // === Update badge counts incrementally - O(1) ===
        // Decrement count for the card we're leaving behind
        const currentCard = this.getCurrentCard();
        if (currentCard) {
            const badgeType = this.getBadgeTypeForState(currentCard.fsrs.state);
            this.cachedBadgeCounts[badgeType]--;
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
     * Record an answer and move to next card in a single batched update.
     * This eliminates double rendering by calling notifyListeners only once.
     * @param requeueData Optional data for requeuing learning cards
     * @returns true if there are more cards, false if session is complete
     */
    recordAnswerAndNext(
        rating: Grade,
        updatedCard: FSRSFlashcardItem,
        requeueData?: { card: FSRSFlashcardItem; position: number }
    ): boolean {
        if (!this.state.isActive) {
            return false;
        }

        const currentCard = this.getCurrentCard();
        if (!currentCard) {
            return false;
        }

        const prevState = this.state;

        // === Update badge counts incrementally - O(1) ===
        // Decrement count for the card we just answered (it's leaving "remaining")
        const oldBadgeType = this.getBadgeTypeForState(currentCard.fsrs.state);
        this.cachedBadgeCounts[oldBadgeType]--;

        // If card is requeued, increment count for its new state
        if (requeueData) {
            const newBadgeType = this.getBadgeTypeForState(requeueData.card.fsrs.state);
            this.cachedBadgeCounts[newBadgeType]++;
        }

        // === Record answer logic ===
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

        // Update queue with new card data
        let newQueue = [...this.state.queue];
        newQueue[this.state.currentIndex] = updatedCard;

        // === Requeue logic (if needed) ===
        if (requeueData) {
            newQueue.splice(requeueData.position, 0, requeueData.card);
        }

        // === Next card logic ===
        const nextIndex = this.state.currentIndex + 1;

        this.state = {
            ...this.state,
            queue: newQueue,
            results: [...this.state.results, result],
            currentIndex: nextIndex,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
        };
        this.schedulingPreview = null;

        // Single notification for both operations
        this.notifyListeners(prevState);

        return nextIndex < newQueue.length;
    }

    /**
     * Re-queue a card (for learning cards that need to be reviewed again soon)
     */
    requeueCard(card: FSRSFlashcardItem, position?: number): void {
        const prevState = this.state;
        const newQueue = [...this.state.queue];

        const insertPosition = position !== undefined ? position : newQueue.length;
        if (position !== undefined) {
            newQueue.splice(position, 0, card);
        } else {
            newQueue.push(card);
        }

        // === Update badge counts incrementally - O(1) ===
        // Only increment if inserted position is in remaining queue (>= currentIndex)
        if (insertPosition >= this.state.currentIndex) {
            const badgeType = this.getBadgeTypeForState(card.fsrs.state);
            this.cachedBadgeCounts[badgeType]++;
        }

        this.state = {
            ...this.state,
            queue: newQueue,
        };
        this.notifyListeners(prevState);
    }

    /**
     * Undo the last answer - go back to previous card with restored data
     * @param requeuedAtIndex - if the card was requeued, remove it from this position
     */
    undoLastAnswer(
        previousIndex: number,
        restoredCard: FSRSFlashcardItem,
        requeuedAtIndex?: number
    ): void {
        if (!this.state.isActive) {
            return;
        }

        const prevState = this.state;

        // === Update badge counts incrementally - O(1) ===
        // Add back the restored card (it's re-entering "remaining")
        const restoredBadgeType = this.getBadgeTypeForState(restoredCard.fsrs.state);
        this.cachedBadgeCounts[restoredBadgeType]++;

        // If there was a requeued copy, remove its count
        if (requeuedAtIndex !== undefined && requeuedAtIndex < this.state.queue.length) {
            const requeuedCard = this.state.queue[requeuedAtIndex];
            if (requeuedCard) {
                const requeuedBadgeType = this.getBadgeTypeForState(requeuedCard.fsrs.state);
                this.cachedBadgeCounts[requeuedBadgeType]--;
            }
        }

        // Restore the card in the queue
        let newQueue = [...this.state.queue];
        newQueue[previousIndex] = restoredCard;

        // Remove requeued copy if it exists (for learning cards)
        if (requeuedAtIndex !== undefined && requeuedAtIndex < newQueue.length) {
            // The requeued card is after previousIndex, so we can safely remove it
            newQueue.splice(requeuedAtIndex, 1);
        }

        // Remove the last result - stats are computed from results array
        const newResults = this.state.results.slice(0, -1);

        this.state = {
            ...this.state,
            queue: newQueue,
            currentIndex: previousIndex,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
            results: newResults,
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
     * Get session statistics computed from results array
     * Single source of truth - no manual counter tracking needed
     */
    getStats(): ReviewSessionStats {
        const results = this.state.results;
        return {
            total: this.state.queue.length,
            reviewed: results.length,
            again: results.filter(r => r.rating === Rating.Again).length,
            hard: results.filter(r => r.rating === Rating.Hard).length,
            good: results.filter(r => r.rating === Rating.Good).length,
            easy: results.filter(r => r.rating === Rating.Easy).length,
            newCards: results.filter(r => r.previousState === State.New).length,
            learningCards: results.filter(r =>
                r.previousState === State.Learning || r.previousState === State.Relearning
            ).length,
            reviewCards: results.filter(r => r.previousState === State.Review).length,
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
     * Get current session phase - explicit state machine
     * Consolidates multiple boolean checks into a single discriminated union
     */
    getPhase(): SessionPhase {
        // Not active and has stats = just finished
        if (!this.state.isActive) {
            if (this.state.stats.reviewed > 0) {
                return { type: "complete", stats: this.getStats() };
            }
            return { type: "idle" };
        }

        // All cards reviewed
        if (this.state.currentIndex >= this.state.queue.length) {
            return { type: "complete", stats: this.getStats() };
        }

        // Check if waiting for learning cards
        const currentCard = this.getCurrentCard();
        if (currentCard) {
            const isLearning =
                currentCard.fsrs.state === State.Learning ||
                currentCard.fsrs.state === State.Relearning;
            if (isLearning && !this.isCardDueNow(currentCard)) {
                return { type: "waiting", timeUntilDue: this.getTimeUntilNextDue() };
            }
            return { type: "active", card: currentCard };
        }

        return { type: "idle" };
    }

    /**
     * Get remaining cards count
     */
    getRemainingCount(): number {
        return Math.max(0, this.state.queue.length - this.state.currentIndex);
    }

    /**
     * Check if a card is due now (or within learn ahead limit for Review cards)
     * Learning/Relearning cards must be actually due (no learn-ahead) to respect
     * learning step intervals - showing them early defeats spaced repetition.
     */
    isCardDueNow(card: FSRSFlashcardItem): boolean {
        const dueDate = new Date(card.fsrs.due);
        const now = new Date();

        // For Learning/Relearning: strict check, must be actually due
        // This ensures learning steps are respected (e.g., 30-min step waits 30 min)
        const isLearning =
            card.fsrs.state === State.Learning ||
            card.fsrs.state === State.Relearning;
        if (isLearning) {
            return dueDate <= now;
        }

        // For Review/New cards: allow learn-ahead window
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
     * - Time until due is <= 60 minutes (otherwise treat as session complete)
     */
    isWaitingForLearningCards(): boolean {
        if (!this.state.isActive) return false;

        const currentCard = this.getCurrentCard();
        if (!currentCard) return false;

        // Check if current card is a learning/relearning card that's not due yet
        const isLearning = currentCard.fsrs.state === State.Learning || currentCard.fsrs.state === State.Relearning;
        if (!isLearning) return false;

        if (this.isCardDueNow(currentCard)) return false;

        // Don't show waiting screen for >60 min waits - treat as session complete
        const MAX_WAIT_MS = 60 * 60 * 1000;
        const timeUntilDue = this.getTimeUntilNextDue();
        return timeUntilDue <= MAX_WAIT_MS;
    }

    /**
     * Remove current card from queue (for suspend/delete)
     */
    removeCurrentCard(): void {
        if (!this.state.isActive) {
            return;
        }

        // === Update badge counts incrementally - O(1) ===
        const currentCard = this.getCurrentCard();
        if (currentCard) {
            const badgeType = this.getBadgeTypeForState(currentCard.fsrs.state);
            this.cachedBadgeCounts[badgeType]--;
        }

        const prevState = this.state;
        const newQueue = [...this.state.queue];
        newQueue.splice(this.state.currentIndex, 1);

        this.state = {
            ...this.state,
            queue: newQueue,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
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

        const cardIndex = this.state.queue.findIndex(c => c.id === cardId);

        if (cardIndex === -1) {
            return; // Card not found
        }

        // === Update badge counts incrementally - O(1) ===
        // Only decrement if card is in remaining queue (index >= currentIndex)
        if (cardIndex >= this.state.currentIndex) {
            const card = this.state.queue[cardIndex];
            if (card) {
                const badgeType = this.getBadgeTypeForState(card.fsrs.state);
                this.cachedBadgeCounts[badgeType]--;
            }
        }

        const prevState = this.state;
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
        };
        this.schedulingPreview = null;
        this.notifyListeners(prevState);
    }

    /**
     * Remove multiple cards from queue by IDs (batch operation)
     * Only notifies listeners once at the end for better performance
     */
    removeCardsByIds(cardIds: string[]): void {
        if (!this.state.isActive || cardIds.length === 0) {
            return;
        }

        const prevState = this.state;
        const idsToRemove = new Set(cardIds);
        let newIndex = this.state.currentIndex;
        let removedBeforeCurrent = 0;

        // Count cards removed before current index
        for (let i = 0; i < this.state.currentIndex; i++) {
            const card = this.state.queue[i];
            if (card && idsToRemove.has(card.id)) {
                removedBeforeCurrent++;
            }
        }

        // === Update badge counts incrementally - O(N) but only for removed cards ===
        // Decrement counts for cards in remaining queue (index >= currentIndex)
        for (let i = this.state.currentIndex; i < this.state.queue.length; i++) {
            const card = this.state.queue[i];
            if (card && idsToRemove.has(card.id)) {
                const badgeType = this.getBadgeTypeForState(card.fsrs.state);
                this.cachedBadgeCounts[badgeType]--;
            }
        }

        // Filter out removed cards
        const newQueue = this.state.queue.filter(c => !idsToRemove.has(c.id));

        // Adjust currentIndex based on cards removed before it
        newIndex = Math.max(0, newIndex - removedBeforeCurrent);
        if (newIndex >= newQueue.length && newQueue.length > 0) {
            newIndex = newQueue.length - 1;
        }

        this.state = {
            ...this.state,
            queue: newQueue,
            currentIndex: newIndex,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
        };
        this.schedulingPreview = null;
        // Single notification for all removals
        this.notifyListeners(prevState);
    }

    /**
     * Add a new card to the end of the queue
     */
    addCardToQueue(card: FSRSFlashcardItem): void {
        if (!this.state.isActive) {
            return;
        }

        // === Update badge counts incrementally - O(1) ===
        // Card added to end is always in remaining queue
        const badgeType = this.getBadgeTypeForState(card.fsrs.state);
        this.cachedBadgeCounts[badgeType]++;

        const prevState = this.state;
        const newQueue = [...this.state.queue, card];

        this.state = {
            ...this.state,
            queue: newQueue,
        };
        this.notifyListeners(prevState);
    }

    /**
     * Insert a card at a specific position in the queue (for undo bury)
     */
    insertCardAtPosition(card: FSRSFlashcardItem, position: number): void {
        if (!this.state.isActive) {
            return;
        }

        // Clamp position to valid range
        const clampedPosition = Math.max(0, Math.min(position, this.state.queue.length));

        // === Update badge counts incrementally - O(1) ===
        // Only increment if inserted position is in remaining queue (>= currentIndex)
        if (clampedPosition >= this.state.currentIndex) {
            const badgeType = this.getBadgeTypeForState(card.fsrs.state);
            this.cachedBadgeCounts[badgeType]++;
        }

        const prevState = this.state;
        const newQueue = [...this.state.queue];
        newQueue.splice(clampedPosition, 0, card);

        this.state = {
            ...this.state,
            queue: newQueue,
            isAnswerRevealed: false,
            questionShownTime: Date.now(),
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
