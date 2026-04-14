import { State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import type { PresetDailyProgress } from "@true-recall/core/persistence/session/session-persistence.service";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs";
import type { FSRSPreset } from "@true-recall/core/types/settings.types";

import { aggregateCardsWithPresetLimits } from "@true-recall/plugins/status-bar-widget/StatusBarWidget";

function makePreset(
	id: string,
	name: string,
	newCardsPerDay: number,
	reviewsPerDay: number,
): FSRSPreset {
	return {
		id,
		name,
		requestRetention: 0.9,
		maximumInterval: 36500,
		weights: null,
		learningSteps: [1, 10],
		relearningSteps: [10],
		newCardsPerDay,
		reviewsPerDay,
		createdAt: Date.now(),
		lastOptimization: null,
		lastOptimizationReviewCount: null,
		lastOptimizationMetrics: null,
	};
}

function makeCard(params: {
	id: string;
	state: State;
	due?: string;
	sourceUid?: string;
	sourceNotePath?: string;
	suspended?: boolean;
	buriedUntil?: string;
}): FSRSFlashcardItem {
	return {
		id: params.id,
		question: "Q",
		answer: "A",
		sourceUid: params.sourceUid,
		sourceNotePath: params.sourceNotePath ?? `${params.id}.md`,
		fsrs: {
			id: params.id,
			due: params.due ?? "2026-03-01T08:00:00.000Z",
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			state: params.state,
			lastReview: null,
			scheduledDays: 0,
			learningStep: 0,
			suspended: params.suspended,
			buriedUntil: params.buriedUntil,
		},
	};
}

function progressMap(
	rows: Array<[string, PresetDailyProgress]>,
): Map<string, PresetDailyProgress> {
	return new Map(rows);
}

describe("aggregateCardsWithPresetLimits", () => {
	it("counts duplicate card ids only once", () => {
		const preset = makePreset("p-default", "Default", 20, 200);
		const card = makeCard({
			id: "card-1",
			state: State.Review,
			due: "2026-03-01T09:00:00.000Z",
		});
		const now = new Date("2026-03-01T10:00:00.000Z");

		const result = aggregateCardsWithPresetLimits(
			[
				{ card, preset },
				{ card: { ...card }, preset },
			],
			new Set(),
			progressMap([]),
			now,
		);

		expect(result).toEqual({ dueToday: 1, newCount: 0, learning: 0 });
	});

	it("applies independent per-preset limits and progress", () => {
		const medical = makePreset("p-med", "Medical", 2, 3);
		const language = makePreset("p-lang", "Language", 5, 2);
		const now = new Date("2026-03-01T10:00:00.000Z");

		const entries = [
			{ card: makeCard({ id: "m-new-1", state: State.New }), preset: medical },
			{ card: makeCard({ id: "m-new-2", state: State.New }), preset: medical },
			{ card: makeCard({ id: "m-new-3", state: State.New }), preset: medical },
			{
				card: makeCard({ id: "m-due-1", state: State.Review }),
				preset: medical,
			},
			{
				card: makeCard({ id: "m-due-2", state: State.Review }),
				preset: medical,
			},
			{
				card: makeCard({ id: "m-due-3", state: State.Review }),
				preset: medical,
			},
			{
				card: makeCard({ id: "m-due-4", state: State.Review }),
				preset: medical,
			},
			{ card: makeCard({ id: "l-new-1", state: State.New }), preset: language },
			{ card: makeCard({ id: "l-new-2", state: State.New }), preset: language },
			{ card: makeCard({ id: "l-new-3", state: State.New }), preset: language },
			{
				card: makeCard({ id: "l-due-1", state: State.Review }),
				preset: language,
			},
			{
				card: makeCard({ id: "l-due-2", state: State.Review }),
				preset: language,
			},
			{
				card: makeCard({ id: "l-due-3", state: State.Review }),
				preset: language,
			},
		];

		const result = aggregateCardsWithPresetLimits(
			entries,
			new Set(),
			progressMap([
				["Medical", { newStudied: 1, reviewsCompleted: 1 }],
				["Language", { newStudied: 4, reviewsCompleted: 0 }],
			]),
			now,
		);

		// Medical: new min(3, 1), due min(4, 2)
		// Language: new min(3, 1), due min(3, 2)
		expect(result).toEqual({ dueToday: 4, newCount: 2, learning: 0 });
	});

	it("filters archived/suspended/buried cards and keeps learning uncapped", () => {
		const preset = makePreset("p-default", "Default", 20, 200);
		const now = new Date("2026-03-01T10:00:00.000Z");

		const result = aggregateCardsWithPresetLimits(
			[
				{
					card: makeCard({
						id: "archived-new",
						state: State.New,
						sourceUid: "uid-arch",
					}),
					preset,
				},
				{
					card: makeCard({
						id: "suspended-due",
						state: State.Review,
						suspended: true,
					}),
					preset,
				},
				{
					card: makeCard({
						id: "buried-due",
						state: State.Review,
						buriedUntil: "2026-03-01T11:00:00.000Z",
					}),
					preset,
				},
				{ card: makeCard({ id: "learning", state: State.Learning }), preset },
				{ card: makeCard({ id: "due", state: State.Review }), preset },
			],
			new Set(["uid-arch"]),
			progressMap([]),
			now,
		);

		expect(result).toEqual({ dueToday: 1, newCount: 0, learning: 1 });
	});

	it("excludes orphaned cards (missing sourceNotePath) from StatusBar counts", () => {
		const preset = makePreset("p-default", "Default", 20, 200);
		const now = new Date("2026-03-01T10:00:00.000Z");

		const result = aggregateCardsWithPresetLimits(
			[
				{
					card: makeCard({
						id: "orphaned-new",
						state: State.New,
						sourceNotePath: "",
					}),
					preset,
				},
				{
					card: makeCard({
						id: "linked-new",
						state: State.New,
						sourceNotePath: "linked.md",
					}),
					preset,
				},
			],
			new Set(),
			progressMap([]),
			now,
		);

		expect(result).toEqual({ dueToday: 0, newCount: 1, learning: 0 });
	});
});
