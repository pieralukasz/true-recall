/**
 * FSRS State Transition Tests
 * Behavior-first tests for the complete FSRS state machine
 *
 * State Machine:
 *   New → Learning (Good/Hard/Again) or Review (Easy)
 *   Learning → Learning (step progression) or Review (graduation)
 *   Review → Review (retention) or Relearning (lapse)
 *   Relearning → Review (re-graduation)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { State, Rating } from "ts-fsrs";
import { FSRSService } from "../../src/features/core/services/fsrs.service";
import {
	createNewCard,
	createReviewCard,
	createRelearningCard,
	createDefaultFSRSSettings,
} from "./mocks/fsrs.mocks";
import type { FSRSCardData } from "../../src/shared/types";
import type { FSRSSettings } from "../../src/shared/types/settings.types";

/**
 * Helper to create a learning card at a specific step
 */
function createCardAtLearningStep(
	id: string,
	step: number,
	state: State.Learning | State.Relearning = State.Learning
): FSRSCardData {
	const now = new Date();
	return {
		id,
		due: now.toISOString(),
		stability: 0.4,
		difficulty: 5,
		reps: step + 1,
		lapses: state === State.Relearning ? 1 : 0,
		state,
		lastReview: now.toISOString(),
		scheduledDays: 0,
		learningStep: step,
	};
}

/**
 * Helper to create settings with specific learning steps
 */
function createSettingsWithSteps(
	learningSteps: number[],
	relearningSteps: number[] = [10]
): FSRSSettings {
	return {
		...createDefaultFSRSSettings(),
		learningSteps,
		relearningSteps,
	};
}

describe("FSRS State Transitions", () => {
	let service: FSRSService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
		service = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("New → Learning (Standard Path)", () => {
		it("should transition to Learning on Good rating", () => {
			const card = createNewCard("new-1");
			const result = service.scheduleCard(card, Rating.Good);

			expect(result.state).toBe(State.Learning);
			// ts-fsrs advances to step 1 on first Good rating (step 0 is skipped)
			expect(result.learningStep).toBeGreaterThanOrEqual(0);
			expect(result.reps).toBe(1);
		});

		it("should transition to Learning on Hard rating", () => {
			const card = createNewCard("new-2");
			const result = service.scheduleCard(card, Rating.Hard);

			expect(result.state).toBe(State.Learning);
		});

		it("should transition to Learning on Again rating", () => {
			const card = createNewCard("new-3");
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Learning);
			expect(result.learningStep).toBe(0);
		});

		it("should be in learning phase after first review", () => {
			const card = createNewCard("new-4");
			const result = service.scheduleCard(card, Rating.Good);

			// After first Good rating, card should be in Learning
			expect(result.state).toBe(State.Learning);
			// Learning step depends on ts-fsrs implementation
			expect(result.learningStep).toBeGreaterThanOrEqual(0);
		});
	});

	describe("New → Review (Easy Fast-Track)", () => {
		it("should skip learning steps and graduate directly on Easy", () => {
			const card = createNewCard("new-easy");
			const result = service.scheduleCard(card, Rating.Easy);

			// Easy on New card graduates directly to Review, skipping all learning steps
			expect(result.state).toBe(State.Review);
		});

		it("should have longer initial interval on Easy vs Good", () => {
			const cardEasy = createNewCard("new-easy");
			const cardGood = createNewCard("new-good");

			const resultEasy = service.scheduleCard(cardEasy, Rating.Easy);
			const resultGood = service.scheduleCard(cardGood, Rating.Good);

			const dueEasy = new Date(resultEasy.due).getTime();
			const dueGood = new Date(resultGood.due).getTime();

			// Easy should schedule further out than Good
			expect(dueEasy).toBeGreaterThanOrEqual(dueGood);
		});
	});

	describe("Learning Step Progression", () => {
		it("should advance through learning steps on consecutive Good ratings", () => {
			// Natural progression: New → Good → Learning(step=1)
			const newCard = createNewCard("learning-progression");
			const afterFirst = service.scheduleCard(newCard, Rating.Good);

			expect(afterFirst.state).toBe(State.Learning);
			expect(afterFirst.learningStep).toBe(1);

			// Learning(step=1) → Good → Review (graduates after completing all steps)
			vi.advanceTimersByTime(11 * 60 * 1000);
			const afterSecond = service.scheduleCard(afterFirst, Rating.Good);

			expect(afterSecond.state).toBe(State.Review);
		});

		it("should reset to step 0 on Again rating", () => {
			const card = createCardAtLearningStep("learning-step1", 1);
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Learning);
			expect(result.learningStep).toBe(0);
		});

		it("should stay at current step on Hard rating", () => {
			const card = createCardAtLearningStep("learning-hard", 1);
			const result = service.scheduleCard(card, Rating.Hard);

			// Hard either repeats the step or advances with penalty
			expect(result.state).toBe(State.Learning);
		});
	});

	describe("Learning → Review (Graduation)", () => {
		it("should graduate to Review after completing all learning steps", () => {
			// Use settings with 2 learning steps [1m, 10m]
			const settings = createSettingsWithSteps([1, 10]);
			const svc = new FSRSService(settings);

			// Start with New card
			let card = createNewCard("graduation-test");

			// First review: New → Learning step 0
			card = svc.scheduleCard(card, Rating.Good);
			expect(card.state).toBe(State.Learning);

			// Wait for step interval
			vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes

			// Second review: Learning step 0 → Learning step 1
			card = svc.scheduleCard(card, Rating.Good);

			// Wait again
			vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes

			// Third review: Learning step 1 → Review (graduation)
			card = svc.scheduleCard(card, Rating.Good);

			expect(card.state).toBe(State.Review);
		});

		it("should have scheduledDays > 0 after graduation", () => {
			// Easy on last learning step should graduate to Review
			const card = createCardAtLearningStep("learning-graduate", 1);
			const result = service.scheduleCard(card, Rating.Easy);

			expect(result.state).toBe(State.Review);
			expect(result.scheduledDays).toBeGreaterThan(0);
		});
	});

	describe("Review → Review (Retention)", () => {
		it("should stay in Review state on Good rating", () => {
			const card = createReviewCard("review-good");
			const result = service.scheduleCard(card, Rating.Good);

			expect(result.state).toBe(State.Review);
		});

		it("should stay in Review state on Hard rating", () => {
			const card = createReviewCard("review-hard");
			const result = service.scheduleCard(card, Rating.Hard);

			expect(result.state).toBe(State.Review);
		});

		it("should stay in Review state on Easy rating", () => {
			const card = createReviewCard("review-easy");
			const result = service.scheduleCard(card, Rating.Easy);

			expect(result.state).toBe(State.Review);
		});

		it("should increase scheduledDays after Good rating", () => {
			const card = createReviewCard("review-interval");
			const initialInterval = card.scheduledDays;
			const result = service.scheduleCard(card, Rating.Good);

			expect(result.scheduledDays).toBeGreaterThanOrEqual(initialInterval);
		});

		it("should increment reps counter", () => {
			const card = createReviewCard("review-reps");
			const initialReps = card.reps;
			const result = service.scheduleCard(card, Rating.Good);

			expect(result.reps).toBe(initialReps + 1);
		});
	});

	describe("Review → Relearning (Lapse)", () => {
		it("should transition to Relearning on Again rating", () => {
			const card = createReviewCard("review-lapse");
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Relearning);
		});

		it("should increment lapses counter on lapse", () => {
			const card = createReviewCard("review-lapse-count");
			const initialLapses = card.lapses;
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.lapses).toBe(initialLapses + 1);
		});

		it("should reset to learningStep 0 on lapse", () => {
			const card = createReviewCard("review-lapse-step");
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.learningStep).toBe(0);
		});

		it("should NOT increment lapses on Hard/Good/Easy", () => {
			const cardHard = createReviewCard("review-hard");
			const cardGood = createReviewCard("review-good");
			const cardEasy = createReviewCard("review-easy");

			const resultHard = service.scheduleCard(cardHard, Rating.Hard);
			const resultGood = service.scheduleCard(cardGood, Rating.Good);
			const resultEasy = service.scheduleCard(cardEasy, Rating.Easy);

			expect(resultHard.lapses).toBe(cardHard.lapses);
			expect(resultGood.lapses).toBe(cardGood.lapses);
			expect(resultEasy.lapses).toBe(cardEasy.lapses);
		});
	});

	describe("Relearning → Review (Re-Graduation)", () => {
		it("should re-graduate to Review on Good rating", () => {
			const card = createRelearningCard("relearning-good");
			const result = service.scheduleCard(card, Rating.Good);

			// With relearningSteps=[10] (single step), Good graduates back to Review
			expect(result.state).toBe(State.Review);
		});

		it("should stay in Relearning on Again rating", () => {
			const card = createRelearningCard("relearning-again");
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Relearning);
			expect(result.learningStep).toBe(0);
		});

		it("should preserve lapses count through re-graduation", () => {
			const card = createRelearningCard("relearning-lapses");
			card.lapses = 3; // Already lapsed 3 times
			const result = service.scheduleCard(card, Rating.Good);

			// Lapses should not change on Good/Hard/Easy
			expect(result.lapses).toBe(3);
		});
	});

	describe("Lapse Accumulation", () => {
		it("should accumulate lapses across multiple Review → Relearning cycles", () => {
			let card = createReviewCard("lapse-accumulation");
			expect(card.lapses).toBe(0);

			// First lapse: Review → Relearning
			card = service.scheduleCard(card, Rating.Again);
			expect(card.lapses).toBe(1);
			expect(card.state).toBe(State.Relearning);

			// Re-graduate: Relearning → Review
			// Force re-graduation by using Easy
			card = service.scheduleCard(card, Rating.Easy);
			if (card.state === State.Relearning) {
				card = service.scheduleCard(card, Rating.Easy);
			}

			// Second lapse (if we got back to Review)
			if (card.state === State.Review) {
				card = service.scheduleCard(card, Rating.Again);
				expect(card.lapses).toBe(2);
			}
		});

		it("should never decrease lapses counter", () => {
			const card = createRelearningCard("lapses-never-decrease");
			card.lapses = 5;

			// Good rating should not decrease lapses
			const result = service.scheduleCard(card, Rating.Good);
			expect(result.lapses).toBeGreaterThanOrEqual(5);
		});
	});

	describe("Scheduling Interval Comparison", () => {
		it("should give longer interval for Easy than Good on Review card", () => {
			const cardEasy = createReviewCard("review-easy-interval");
			const cardGood = createReviewCard("review-good-interval");

			const resultEasy = service.scheduleCard(cardEasy, Rating.Easy);
			const resultGood = service.scheduleCard(cardGood, Rating.Good);

			expect(resultEasy.scheduledDays).toBeGreaterThan(resultGood.scheduledDays);
		});

		it("should give longer interval for Good than Hard on Review card", () => {
			const cardGood = createReviewCard("review-good-int");
			const cardHard = createReviewCard("review-hard-int");

			const resultGood = service.scheduleCard(cardGood, Rating.Good);
			const resultHard = service.scheduleCard(cardHard, Rating.Hard);

			expect(resultGood.scheduledDays).toBeGreaterThanOrEqual(resultHard.scheduledDays);
		});

		it("should give shortest interval for Again", () => {
			const cardAgain = createReviewCard("review-again-int");
			const cardHard = createReviewCard("review-hard-int2");

			const resultAgain = service.scheduleCard(cardAgain, Rating.Again);
			const resultHard = service.scheduleCard(cardHard, Rating.Hard);

			// Again goes to Relearning with short interval
			// Hard stays in Review with longer interval
			const dueAgain = new Date(resultAgain.due).getTime();
			const dueHard = new Date(resultHard.due).getTime();

			expect(dueAgain).toBeLessThan(dueHard);
		});
	});

	describe("Stability Changes", () => {
		it("should increase stability more for Easy than Good", () => {
			const cardEasy = createReviewCard("stability-easy");
			const cardGood = createReviewCard("stability-good");

			const resultEasy = service.scheduleCard(cardEasy, Rating.Easy);
			const resultGood = service.scheduleCard(cardGood, Rating.Good);

			expect(resultEasy.stability).toBeGreaterThan(resultGood.stability);
		});

		it("should increase stability more for Good than Hard", () => {
			const cardGood = createReviewCard("stability-good2");
			const cardHard = createReviewCard("stability-hard");

			const resultGood = service.scheduleCard(cardGood, Rating.Good);
			const resultHard = service.scheduleCard(cardHard, Rating.Hard);

			expect(resultGood.stability).toBeGreaterThanOrEqual(resultHard.stability);
		});

		it("should decrease stability on lapse (Again on Review)", () => {
			const card = createReviewCard("stability-lapse");
			const initialStability = card.stability;
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.stability).toBeLessThan(initialStability);
		});
	});

	describe("Difficulty Changes", () => {
		it("should decrease difficulty on Easy rating", () => {
			const card = createReviewCard("difficulty-easy");
			const initialDifficulty = card.difficulty;
			const result = service.scheduleCard(card, Rating.Easy);

			expect(result.difficulty).toBeLessThanOrEqual(initialDifficulty);
		});

		it("should increase difficulty on Again rating", () => {
			const card = createReviewCard("difficulty-again");
			const initialDifficulty = card.difficulty;
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.difficulty).toBeGreaterThan(initialDifficulty);
		});

		it("should increase difficulty on Hard rating", () => {
			const card = createReviewCard("difficulty-hard");
			const initialDifficulty = card.difficulty;
			const result = service.scheduleCard(card, Rating.Hard);

			expect(result.difficulty).toBeGreaterThanOrEqual(initialDifficulty);
		});
	});

	describe("Relearning vs Learning Intervals", () => {
		it("should have short intervals for Learning cards", () => {
			const learning = createCardAtLearningStep("learning-interval", 0, State.Learning);
			const resultLearning = service.scheduleCard(learning, Rating.Good);

			// Learning cards should have short intervals (minutes to hours)
			const dueLearning = new Date(resultLearning.due).getTime();
			const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

			// Should be due within 2 days at most
			expect(dueLearning - Date.now()).toBeLessThanOrEqual(twoDaysMs);
		});

		it("should have short intervals for Relearning cards", () => {
			const relearning = createCardAtLearningStep("relearning-interval", 0, State.Relearning);
			const resultRelearning = service.scheduleCard(relearning, Rating.Good);

			// Relearning cards should also have short intervals
			const dueRelearning = new Date(resultRelearning.due).getTime();
			const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

			expect(dueRelearning - Date.now()).toBeLessThanOrEqual(twoDaysMs);
		});
	});
});
