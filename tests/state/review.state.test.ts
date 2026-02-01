/**
 * Tests for ReviewStateManager
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ReviewStateManager } from "../../src/state/review.state";
import { State } from "ts-fsrs";
import type { FSRSFlashcardItem, ReviewSessionState } from "../../src/types";

/**
 * Create a mock FSRSFlashcardItem for testing
 */
function createMockCard(overrides?: Partial<FSRSFlashcardItem>): FSRSFlashcardItem {
    return {
        id: "card-1",
        question: "Test question?",
        answer: "Test answer",
        sourceUid: "source-uid-1",
        fsrs: {
            id: "card-1",
            due: new Date().toISOString(),
            stability: 1,
            difficulty: 0.3,
            reps: 0,
            lapses: 0,
            state: State.New,
            lastReview: null,
            scheduledDays: 0,
            learningStep: 0,
        },
        ...overrides,
    };
}

/**
 * Create a learning card with specific due time
 */
function createLearningCard(dueInMinutes: number): FSRSFlashcardItem {
    const dueDate = new Date(Date.now() + dueInMinutes * 60 * 1000);
    return createMockCard({
        id: `learning-card-${dueInMinutes}`,
        fsrs: {
            id: `learning-card-${dueInMinutes}`,
            due: dueDate.toISOString(),
            stability: 0.5,
            difficulty: 0.3,
            reps: 1,
            lapses: 0,
            state: State.Learning,
            lastReview: new Date().toISOString(),
            scheduledDays: 0,
            learningStep: 1,
        },
    });
}

describe("ReviewStateManager", () => {
    let stateManager: ReviewStateManager;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-01T10:00:00Z"));
        stateManager = new ReviewStateManager();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("isWaitingForLearningCards", () => {
        it("should return false when session is not active", () => {
            // Session is not started
            expect(stateManager.isWaitingForLearningCards()).toBe(false);
        });

        it("should return false when current card is not a learning card", () => {
            const reviewCard = createMockCard({
                fsrs: {
                    id: "review-card",
                    due: new Date().toISOString(),
                    stability: 10,
                    difficulty: 0.3,
                    reps: 5,
                    lapses: 0,
                    state: State.Review,
                    lastReview: new Date().toISOString(),
                    scheduledDays: 7,
                    learningStep: 0,
                },
            });

            stateManager.startSession([reviewCard], "due-date");
            expect(stateManager.isWaitingForLearningCards()).toBe(false);
        });

        it("should return false when learning card is due now (within learn ahead limit)", () => {
            // Card due in 5 minutes (within 20 minute learn ahead limit)
            const learningCard = createLearningCard(5);
            stateManager.startSession([learningCard], "due-date");

            expect(stateManager.isWaitingForLearningCards()).toBe(false);
        });

        it("should return true when learning card is due in <60 minutes but beyond learn ahead", () => {
            // Card due in 30 minutes (beyond 20 min learn ahead, but within 60 min max wait)
            const learningCard = createLearningCard(30);
            stateManager.startSession([learningCard], "due-date");

            expect(stateManager.isWaitingForLearningCards()).toBe(true);
        });

        it("should return true when learning card is due in exactly 60 minutes", () => {
            // Card due in exactly 60 minutes (at the threshold)
            const learningCard = createLearningCard(60);
            stateManager.startSession([learningCard], "due-date");

            expect(stateManager.isWaitingForLearningCards()).toBe(true);
        });

        it("should return false when learning card is due in >60 minutes", () => {
            // Card due in 90 minutes (beyond max wait threshold)
            const learningCard = createLearningCard(90);
            stateManager.startSession([learningCard], "due-date");

            expect(stateManager.isWaitingForLearningCards()).toBe(false);
        });

        it("should return false when learning card is due in 10+ days", () => {
            // Card due in 10 days (way beyond max wait threshold)
            const learningCard = createLearningCard(10 * 24 * 60);
            stateManager.startSession([learningCard], "due-date");

            expect(stateManager.isWaitingForLearningCards()).toBe(false);
        });

        it("should work for Relearning state cards", () => {
            // Relearning card due in 45 minutes
            const relearningCard = createMockCard({
                id: "relearning-card",
                fsrs: {
                    id: "relearning-card",
                    due: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
                    stability: 0.5,
                    difficulty: 0.5,
                    reps: 3,
                    lapses: 1,
                    state: State.Relearning,
                    lastReview: new Date().toISOString(),
                    scheduledDays: 0,
                    learningStep: 0,
                },
            });

            stateManager.startSession([relearningCard], "due-date");
            expect(stateManager.isWaitingForLearningCards()).toBe(true);
        });
    });

    describe("getTimeUntilNextDue", () => {
        it("should return 0 when no pending learning cards", () => {
            const reviewCard = createMockCard({
                fsrs: {
                    id: "review-card",
                    due: new Date().toISOString(),
                    stability: 10,
                    difficulty: 0.3,
                    reps: 5,
                    lapses: 0,
                    state: State.Review,
                    lastReview: new Date().toISOString(),
                    scheduledDays: 7,
                    learningStep: 0,
                },
            });

            stateManager.startSession([reviewCard], "due-date");
            expect(stateManager.getTimeUntilNextDue()).toBe(0);
        });

        it("should return time in milliseconds for pending learning cards", () => {
            // Card due in 30 minutes
            const learningCard = createLearningCard(30);
            stateManager.startSession([learningCard], "due-date");

            const timeUntilDue = stateManager.getTimeUntilNextDue();
            // Should be approximately 30 minutes in ms (minus the 20 min learn ahead that was already checked)
            // Since the card is beyond learn ahead, it returns the full time
            expect(timeUntilDue).toBeGreaterThan(29 * 60 * 1000);
            expect(timeUntilDue).toBeLessThanOrEqual(30 * 60 * 1000);
        });
    });
});
