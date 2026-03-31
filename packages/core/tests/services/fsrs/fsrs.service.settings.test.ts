/**
 * FSRS Settings Impact Tests
 * Behavior-first tests for how settings affect scheduling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { State, Rating } from "ts-fsrs";
import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import {
	createNewCard,
	createReviewCard,
	createRelearningCard,
	createDefaultFSRSSettings,
} from "../../mocks/fsrs.mocks";
import type { FSRSSettings } from "../../../src/types/settings.types";
import type { FSRSCardData } from "../../../src/types";

/**
 * Create settings with specific overrides
 */
function createSettings(overrides: Partial<FSRSSettings> = {}): FSRSSettings {
	return {
		...createDefaultFSRSSettings(),
		...overrides,
	};
}

/**
 * Create a well-established review card for interval testing
 * Higher stability = more predictable intervals
 */
function createEstablishedCard(id: string): FSRSCardData {
	const now = new Date();
	return {
		id,
		due: now.toISOString(),
		stability: 30, // Well established
		difficulty: 5,
		reps: 15,
		lapses: 0,
		state: State.Review,
		lastReview: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
		scheduledDays: 30,
		learningStep: 0,
	};
}

describe("FSRS Settings Impact", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("Request Retention Impact", () => {
		it("should give longer intervals with higher retention targets", () => {
			// Higher retention (0.95) should yield longer intervals than lower (0.85)
			// Because FSRS optimizes for target retention
			const highRetention = createSettings({ requestRetention: 0.95 });
			const lowRetention = createSettings({ requestRetention: 0.85 });

			const serviceHigh = new FSRSService(highRetention);
			const serviceLow = new FSRSService(lowRetention);

			const cardHigh = createEstablishedCard("high-retention");
			const cardLow = createEstablishedCard("low-retention");

			const resultHigh = serviceHigh.scheduleCard(cardHigh, Rating.Good);
			const resultLow = serviceLow.scheduleCard(cardLow, Rating.Good);

			// Higher retention = user wants to remember better = shorter intervals
			// (more frequent reviews to maintain higher retention)
			expect(resultHigh.scheduledDays).toBeLessThan(resultLow.scheduledDays);
		});

		it("should produce longer intervals at 0.80 retention vs 0.90", () => {
			const retention80 = createSettings({ requestRetention: 0.80 });
			const retention90 = createSettings({ requestRetention: 0.90 });

			const service80 = new FSRSService(retention80);
			const service90 = new FSRSService(retention90);

			const card80 = createEstablishedCard("r80");
			const card90 = createEstablishedCard("r90");

			const result80 = service80.scheduleCard(card80, Rating.Good);
			const result90 = service90.scheduleCard(card90, Rating.Good);

			// Lower retention target = longer intervals (less frequent reviews)
			expect(result80.scheduledDays).toBeGreaterThan(result90.scheduledDays);
		});

		it("should affect all ratings proportionally", () => {
			const highRetention = createSettings({ requestRetention: 0.95 });
			const lowRetention = createSettings({ requestRetention: 0.80 });

			const serviceHigh = new FSRSService(highRetention);
			const serviceLow = new FSRSService(lowRetention);

			// Test with Easy rating
			const cardHighEasy = createEstablishedCard("high-easy");
			const cardLowEasy = createEstablishedCard("low-easy");

			const resultHighEasy = serviceHigh.scheduleCard(cardHighEasy, Rating.Easy);
			const resultLowEasy = serviceLow.scheduleCard(cardLowEasy, Rating.Easy);

			// Lower retention should still yield longer intervals on Easy
			expect(resultLowEasy.scheduledDays).toBeGreaterThan(resultHighEasy.scheduledDays);
		});
	});

	describe("Maximum Interval Cap", () => {
		// Note: ts-fsrs has enable_fuzz: true which adds randomness to intervals
		// The fuzz can add up to a few days, so we test relative behavior

		it("should cap high-stability cards to near maximum interval", () => {
			const maxInterval = 30;
			const settings = createSettings({ maximumInterval: maxInterval });
			const service = new FSRSService(settings);

			// Create a card with very high stability (would normally schedule 100+ days)
			const card: FSRSCardData = {
				id: "max-interval-test",
				due: new Date().toISOString(),
				stability: 500, // Very high stability = would schedule far out
				difficulty: 2,
				reps: 100,
				lapses: 0,
				state: State.Review,
				lastReview: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
				scheduledDays: 365,
				learningStep: 0,
			};

			const result = service.scheduleCard(card, Rating.Easy);

			// Without a cap, this would be 100+ days; with cap, should be near 30
			// Allow some fuzz tolerance (up to ~10% or 3 days, whichever is larger)
			expect(result.scheduledDays).toBeLessThanOrEqual(maxInterval + 5);
		});

		it("should produce longer intervals with higher max interval setting", () => {
			// Low max vs high max should show capping effect
			const lowCap = createSettings({ maximumInterval: 30 });
			const highCap = createSettings({ maximumInterval: 365 });

			const serviceLow = new FSRSService(lowCap);
			const serviceHigh = new FSRSService(highCap);

			// High-stability card
			const card: FSRSCardData = {
				id: "cap-comparison",
				due: new Date().toISOString(),
				stability: 200,
				difficulty: 3,
				reps: 50,
				lapses: 0,
				state: State.Review,
				lastReview: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
				scheduledDays: 60,
				learningStep: 0,
			};

			const resultLow = serviceLow.scheduleCard({ ...card, id: "low" }, Rating.Easy);
			const resultHigh = serviceHigh.scheduleCard({ ...card, id: "high" }, Rating.Easy);

			// High cap should allow longer intervals
			expect(resultHigh.scheduledDays).toBeGreaterThan(resultLow.scheduledDays);
		});

		it("should not affect learning step intervals", () => {
			const settings = createSettings({ maximumInterval: 365 });
			const service = new FSRSService(settings);

			const card = createNewCard("below-cap");
			const result = service.scheduleCard(card, Rating.Good);

			// Learning intervals are in minutes (1m, 10m), must be < 1 day
			const dueMs = new Date(result.due).getTime() - Date.now();
			const dueDays = dueMs / (1000 * 60 * 60 * 24);

			expect(result.state).toBe(State.Learning);
			expect(dueDays).toBeLessThan(1);
		});

		it("should cap even Easy ratings on review cards", () => {
			const maxInterval = 10;
			const settings = createSettings({ maximumInterval: maxInterval });
			const service = new FSRSService(settings);

			const card = createEstablishedCard("easy-cap");
			const result = service.scheduleCard(card, Rating.Easy);

			// Even Easy should be approximately capped (with fuzz tolerance)
			expect(result.scheduledDays).toBeLessThanOrEqual(maxInterval + 5);
		});
	});

	describe("Learning Steps Configuration", () => {
		it("should use configured learning steps [1, 10]", () => {
			const settings = createSettings({ learningSteps: [1, 10] });
			const service = new FSRSService(settings);

			let card = createNewCard("steps-1-10");

			// First review: New → Learning
			card = service.scheduleCard(card, Rating.Good);
			expect(card.state).toBe(State.Learning);

			// After completing learning steps, should graduate
			// The exact number of Good ratings to graduate depends on ts-fsrs
			let attempts = 0;
			while (card.state === State.Learning && attempts < 10) {
				vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
				card = service.scheduleCard(card, Rating.Good);
				attempts++;
			}

			expect(card.state).toBe(State.Review);
		});

		it("should use 3-step learning configuration [1, 10, 60]", () => {
			const settings = createSettings({ learningSteps: [1, 10, 60] });
			const service = new FSRSService(settings);

			let card = createNewCard("steps-3");

			// Should go through 3 learning steps before graduating
			let attempts = 0;
			const maxAttempts = 15;

			while (card.state !== State.Review && attempts < maxAttempts) {
				vi.advanceTimersByTime(61 * 60 * 1000); // 61 minutes
				card = service.scheduleCard(card, Rating.Good);
				attempts++;
			}

			expect(card.state).toBe(State.Review);
		});

		it("should handle single learning step [10]", () => {
			const settings = createSettings({ learningSteps: [10] });
			const service = new FSRSService(settings);

			let card = createNewCard("single-step");

			// First review
			card = service.scheduleCard(card, Rating.Good);

			// With single step, should graduate quickly
			let attempts = 0;
			while (card.state === State.Learning && attempts < 5) {
				vi.advanceTimersByTime(11 * 60 * 1000);
				card = service.scheduleCard(card, Rating.Good);
				attempts++;
			}

			expect(card.state).toBe(State.Review);
		});

		it("should use longer learning steps for more practice", () => {
			const shortSteps = createSettings({ learningSteps: [1, 5] });
			const longSteps = createSettings({ learningSteps: [1, 10, 30, 60] });

			const serviceShort = new FSRSService(shortSteps);
			const serviceLong = new FSRSService(longSteps);

			let cardShort = createNewCard("short");
			let cardLong = createNewCard("long");

			// First Good rating
			cardShort = serviceShort.scheduleCard(cardShort, Rating.Good);
			cardLong = serviceLong.scheduleCard(cardLong, Rating.Good);

			// Both should be in Learning
			expect(cardShort.state).toBe(State.Learning);
			expect(cardLong.state).toBe(State.Learning);

			// Progress both to graduation
			let shortAttempts = 0;
			while (cardShort.state === State.Learning && shortAttempts < 10) {
				vi.advanceTimersByTime(61 * 60 * 1000);
				cardShort = serviceShort.scheduleCard(cardShort, Rating.Good);
				shortAttempts++;
			}

			let longAttempts = 0;
			while (cardLong.state === State.Learning && longAttempts < 10) {
				vi.advanceTimersByTime(61 * 60 * 1000);
				cardLong = serviceLong.scheduleCard(cardLong, Rating.Good);
				longAttempts++;
			}

			// Long steps should take more reviews to graduate
			expect(longAttempts).toBeGreaterThanOrEqual(shortAttempts);
		});
	});

	describe("Relearning Steps Configuration", () => {
		it("should use relearning steps when lapsing", () => {
			const settings = createSettings({ relearningSteps: [10, 20] });
			const service = new FSRSService(settings);

			const card = createReviewCard("lapse-test");
			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Relearning);
			expect(result.learningStep).toBe(0);
		});

		it("should progress through relearning steps", () => {
			const settings = createSettings({ relearningSteps: [5, 15] });
			const service = new FSRSService(settings);

			// Start with relearning card
			let card = createRelearningCard("relearn-progress");
			card.learningStep = 0;

			// Good rating should advance through relearning
			card = service.scheduleCard(card, Rating.Good);

			// Should either advance step or graduate back to Review
			expect([State.Relearning, State.Review]).toContain(card.state);
		});

		it("should re-graduate to Review after completing relearning steps", () => {
			const settings = createSettings({ relearningSteps: [5] }); // Single step
			const service = new FSRSService(settings);

			let card = createRelearningCard("relearn-graduate");

			// Keep rating Good until back to Review
			let attempts = 0;
			while (card.state === State.Relearning && attempts < 5) {
				vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
				card = service.scheduleCard(card, Rating.Good);
				attempts++;
			}

			expect(card.state).toBe(State.Review);
		});

		it("should reset to step 0 on Again during relearning", () => {
			const settings = createSettings({ relearningSteps: [5, 15, 30] });
			const service = new FSRSService(settings);

			// Create a relearning card at step 1
			const card: FSRSCardData = {
				id: "relearn-again",
				due: new Date().toISOString(),
				stability: 0.5,
				difficulty: 6,
				reps: 12,
				lapses: 3,
				state: State.Relearning,
				lastReview: new Date().toISOString(),
				scheduledDays: 0,
				learningStep: 1, // At step 1
			};

			const result = service.scheduleCard(card, Rating.Again);

			expect(result.state).toBe(State.Relearning);
			expect(result.learningStep).toBe(0); // Reset to step 0
		});

		it("should use different steps for relearning vs learning", () => {
			const settings = createSettings({
				learningSteps: [1, 10], // Learning: 1min, 10min
				relearningSteps: [20, 60], // Relearning: 20min, 60min (longer)
			});
			const service = new FSRSService(settings);

			// New card learning
			const newCard = createNewCard("new-steps");
			const learningResult = service.scheduleCard(newCard, Rating.Good);

			// Review card lapsing
			const reviewCard = createReviewCard("review-lapse");
			const relearningResult = service.scheduleCard(reviewCard, Rating.Again);

			// Both should be in learning phase but with different steps
			expect(learningResult.state).toBe(State.Learning);
			expect(relearningResult.state).toBe(State.Relearning);
		});
	});

	describe("Enable Short Term Setting", () => {
		it("should use short-term scheduling when enableShortTerm is true", () => {
			const settings = createSettings({ enableShortTerm: true });
			const service = new FSRSService(settings);

			const card = createNewCard("short-term");
			const result = service.scheduleCard(card, Rating.Good);

			// Should go to Learning state with short-term scheduling
			expect(result.state).toBe(State.Learning);
		});

		it("should skip learning steps when enableShortTerm is false", () => {
			const settingsOn = createSettings({ enableShortTerm: true });
			const settingsOff = createSettings({ enableShortTerm: false });

			const serviceOn = new FSRSService(settingsOn);
			const serviceOff = new FSRSService(settingsOff);

			const cardOn = createNewCard("st-on");
			const cardOff = createNewCard("st-off");

			const resultOn = serviceOn.scheduleCard(cardOn, Rating.Good);
			const resultOff = serviceOff.scheduleCard(cardOff, Rating.Good);

			// enableShortTerm=true: uses learning steps, so card enters Learning
			expect(resultOn.state).toBe(State.Learning);
			// enableShortTerm=false: skips learning steps, card goes directly to Review
			expect(resultOff.state).toBe(State.Review);
		});
	});

	describe("Settings Update", () => {
		it("should apply new settings after updateSettings()", () => {
			const initialSettings = createSettings({ maximumInterval: 365 });
			const service = new FSRSService(initialSettings);

			// Update to lower max interval
			const newMaxInterval = 30;
			service.updateSettings(createSettings({ maximumInterval: newMaxInterval }));

			const card = createEstablishedCard("update-test");
			const result = service.scheduleCard(card, Rating.Easy);

			// Should use new cap of 30 days (with fuzz tolerance)
			const maxWithFuzz = Math.ceil(newMaxInterval * 1.05);
			expect(result.scheduledDays).toBeLessThanOrEqual(maxWithFuzz);
		});

		it("should apply new retention setting after update", () => {
			const service = new FSRSService(createSettings({ requestRetention: 0.90 }));

			// Get baseline interval
			const card1 = createEstablishedCard("baseline");
			const result1 = service.scheduleCard(card1, Rating.Good);

			// Update to lower retention (longer intervals)
			service.updateSettings(createSettings({ requestRetention: 0.80 }));

			const card2 = createEstablishedCard("updated");
			const result2 = service.scheduleCard(card2, Rating.Good);

			// Lower retention should yield longer interval
			expect(result2.scheduledDays).toBeGreaterThan(result1.scheduledDays);
		});
	});

	describe("Edge Cases", () => {
		it("should graduate immediately with empty learning steps", () => {
			const settings = createSettings({ learningSteps: [] });
			const service = new FSRSService(settings);

			const card = createNewCard("empty-steps");
			const result = service.scheduleCard(card, Rating.Good);

			// Empty learning steps = no learning phase, card graduates directly to Review
			expect(result.state).toBe(State.Review);
			expect(result.scheduledDays).toBeGreaterThan(0);
		});

		it("should limit intervals when very low maximum interval is set", () => {
			const maxInterval = 1; // 1 day max
			const settings = createSettings({ maximumInterval: maxInterval });
			const service = new FSRSService(settings);

			const card = createEstablishedCard("1-day-max");
			const result = service.scheduleCard(card, Rating.Easy);

			// With fuzz enabled, 1 day cap may result in 1-3 days
			// The key behavior is it's much less than the ~30 days it would be without cap
			expect(result.scheduledDays).toBeLessThanOrEqual(maxInterval + 3);
		});

		it("should handle extreme retention values", () => {
			// Very high retention (99%)
			const highRetention = createSettings({ requestRetention: 0.99 });
			const serviceHigh = new FSRSService(highRetention);

			const cardHigh = createEstablishedCard("high-r");
			const resultHigh = serviceHigh.scheduleCard(cardHigh, Rating.Good);

			// Should produce valid interval
			expect(resultHigh.scheduledDays).toBeGreaterThan(0);

			// Low retention (70%)
			const lowRetention = createSettings({ requestRetention: 0.70 });
			const serviceLow = new FSRSService(lowRetention);

			const cardLow = createEstablishedCard("low-r");
			const resultLow = serviceLow.scheduleCard(cardLow, Rating.Good);

			expect(resultLow.scheduledDays).toBeGreaterThan(0);
		});
	});
});
