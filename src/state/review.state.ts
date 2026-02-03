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

export type ReviewStateListener = (
    state: ReviewSessionState,
    prevState: ReviewSessionState
) => void;

export type ReviewStateSelector<T> = (state: ReviewSessionState) => T;

export interface EditModeState {
    active: boolean;
    field: "question" | "answer" | null;
    originalQuestion: string;
    originalAnswer: string;
}

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

    getState(): ReviewSessionState {
        return { ...this.state };
    }

    getSchedulingPreview(): SchedulingPreview | null {
        return this.schedulingPreview;
    }

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

    /** O(N), called only at session start */
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

    private getBadgeTypeForState(cardState: State): keyof BadgeCounts {
        if (cardState === State.New) return "new";
        if (cardState === State.Learning || cardState === State.Relearning) return "learning";
        return "due";
    }

    subscribe(listener: ReviewStateListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

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

    reset(): void {
        const prevState = this.state;
        this.state = createDefaultSessionState();
        this.schedulingPreview = null;
        this.cachedBadgeCounts = { new: 0, learning: 0, due: 0 };
        this.notifyListeners(prevState);
    }

    getCurrentCard(): FSRSFlashcardItem | null {
        if (!this.state.isActive || this.state.currentIndex >= this.state.queue.length) {
            return null;
        }
        return this.state.queue[this.state.currentIndex] ?? null;
    }

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

        let newQueue = [...this.state.queue];
        newQueue[this.state.currentIndex] = updatedCard;

        if (requeueData) {
            newQueue.splice(requeueData.position, 0, requeueData.card);
        }

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

    /** For learning cards that need to be reviewed again soon */
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

    /** @param requeuedAtIndex - if the card was requeued, remove it from this position */
    undoLastAnswer(
        previousIndex: number,
        restoredCard: FSRSFlashcardItem,
        requeuedAtIndex?: number
    ): void {
        if (!this.state.isActive) {
            return;
        }

        const prevState = this.state;

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

        let newQueue = [...this.state.queue];
        newQueue[previousIndex] = restoredCard;

        if (requeuedAtIndex !== undefined && requeuedAtIndex < newQueue.length) {
            newQueue.splice(requeuedAtIndex, 1);
        }

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

    isActive(): boolean {
        return this.state.isActive;
    }

    isAnswerRevealed(): boolean {
        return this.state.isAnswerRevealed;
    }

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

    getPendingLearningCards(): FSRSFlashcardItem[] {
        const remaining = this.state.queue.slice(this.state.currentIndex);
        return remaining.filter((card) => {
            const isLearning = card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning;
            return isLearning && !this.isCardDueNow(card);
        });
    }

    /** Returns 0 if no pending learning cards or card is already due */
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

        const isLearning = currentCard.fsrs.state === State.Learning || currentCard.fsrs.state === State.Relearning;
        if (!isLearning) return false;

        if (this.isCardDueNow(currentCard)) return false;

        // Don't show waiting screen for >60 min waits - treat as session complete
        const MAX_WAIT_MS = 60 * 60 * 1000;
        const timeUntilDue = this.getTimeUntilNextDue();
        return timeUntilDue <= MAX_WAIT_MS;
    }

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

    /** Only notifies listeners once at the end for better performance */
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

    getEditState(): EditModeState {
        return { ...this.editMode };
    }

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

    cancelEdit(): void {
        this.editMode = {
            active: false,
            field: null,
            originalQuestion: "",
            originalAnswer: "",
        };
    }

    isEditing(): boolean {
        return this.editMode.active;
    }

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

export function createReviewStateManager(): ReviewStateManager {
    return new ReviewStateManager();
}
