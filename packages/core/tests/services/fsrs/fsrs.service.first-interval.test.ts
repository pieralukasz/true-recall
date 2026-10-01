import { default_w, Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import {
	capFirstInterval,
	FSRSService,
} from "../../../src/services/fsrs/fsrs.service";
import type { FSRSSettings } from "../../../src/types/settings.types";
import {
	createDefaultFSRSSettings,
	createNewCard,
} from "../../mocks/fsrs.mocks";

const DAY = 86_400_000;

function settings(over: Partial<FSRSSettings> = {}): FSRSSettings {
	// High initial stability for Good so the uncapped first interval is long
	const w = [...default_w];
	w[2] = 60;
	w[3] = 80;
	return {
		...createDefaultFSRSSettings(),
		enableFuzz: false,
		learningSteps: [],
		weights: w,
		...over,
	};
}

function daysUntil(due: string, from: Date): number {
	return Math.round((new Date(due).getTime() - from.getTime()) / DAY);
}

describe("first interval cap", () => {
	const now = new Date("2026-10-01T08:00:00Z");

	it("caps the graduating interval of a new card", () => {
		const service = new FSRSService(settings());
		const uncapped = service.scheduleCard(createNewCard("a"), Rating.Good, now);
		expect(uncapped.state).toBe(State.Review);
		expect(daysUntil(uncapped.due, now)).toBeGreaterThan(14);

		const capped = service.scheduleCard(
			createNewCard("a"),
			Rating.Good,
			now,
			settings({ firstIntervalMax: 14 }),
		);
		expect(daysUntil(capped.due, now)).toBe(14);
		expect(capped.scheduledDays).toBe(14);
		// Memory state is not changed by the cap
		expect(capped.stability).toBeCloseTo(uncapped.stability, 6);
		expect(capped.difficulty).toBeCloseTo(uncapped.difficulty, 6);
	});

	it("uses the service default settings when no preset settings are passed", () => {
		const service = new FSRSService(settings({ firstIntervalMax: 10 }));
		const card = service.scheduleCard(createNewCard("a"), Rating.Easy, now);
		expect(daysUntil(card.due, now)).toBe(10);
	});

	it("does not cap Review cards or short intervals", () => {
		const service = new FSRSService(settings({ firstIntervalMax: 14 }));
		const first = service.scheduleCard(createNewCard("a"), Rating.Good, now);
		const later = new Date(first.due);
		const second = service.scheduleCard(first, Rating.Good, later);
		expect(daysUntil(second.due, later)).toBeGreaterThan(14);

		// An interval already under the cap is left exactly as FSRS chose it
		const uncappedService = new FSRSService(settings());
		const again = service.scheduleCard(createNewCard("b"), Rating.Again, now);
		const againUncapped = uncappedService.scheduleCard(
			createNewCard("b"),
			Rating.Again,
			now,
		);
		expect(again.due).toBe(againUncapped.due);
	});

	it("is a no-op for null/0 caps and non-graduating transitions", () => {
		const card = {
			due: new Date(now.getTime() + 50 * DAY),
			scheduled_days: 50,
			state: State.Review,
		} as Parameters<typeof capFirstInterval>[1];
		expect(capFirstInterval(State.New, card, now, null)).toBe(card);
		expect(capFirstInterval(State.New, card, now, 0)).toBe(card);
		expect(capFirstInterval(State.Review, card, now, 14)).toBe(card);
		expect(capFirstInterval(State.Relearning, card, now, 14)).toBe(card);
		expect(capFirstInterval(State.Learning, card, now, 14).scheduled_days).toBe(
			14,
		);
	});

	it("caps the Good/Easy buttons in the scheduling preview", () => {
		const service = new FSRSService(settings());
		const preview = service.getSchedulingPreview(
			createNewCard("a"),
			settings({ firstIntervalMax: 7 }),
		);
		const goodDays = Math.round(
			(preview.good.due.getTime() - Date.now()) / DAY,
		);
		expect(goodDays).toBeLessThanOrEqual(7);
	});

	it("spreads capped intervals at or below the cap when fuzz is on", () => {
		const fuzzed = settings({ firstIntervalMax: 14, enableFuzz: true });
		const service = new FSRSService(fuzzed);
		const days = new Set<number>();
		for (let i = 0; i < 200; i++) {
			const card = service.scheduleCard(
				createNewCard(`card-${i}`),
				Rating.Good,
				now,
				fuzzed,
			);
			const d = daysUntil(card.due, now);
			expect(d).toBeGreaterThanOrEqual(12);
			expect(d).toBeLessThanOrEqual(14);
			expect(card.scheduledDays).toBe(d);
			days.add(d);
		}
		expect(days.size).toBeGreaterThan(1);
		// Same card, same answer: same day (preview must match the grade)
		const a = service.scheduleCard(
			createNewCard("same"),
			Rating.Good,
			now,
			fuzzed,
		);
		const b = service.scheduleCard(
			createNewCard("same"),
			Rating.Good,
			now,
			fuzzed,
		);
		expect(a.due).toBe(b.due);
	});
});
