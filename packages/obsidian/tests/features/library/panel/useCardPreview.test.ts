import { Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { FSRSPreset, FSRSSettings } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import {
	buildStandaloneReviewCommand,
	isCardGradable,
	toPreviewIntervals,
} from "@true-recall/obsidian/features/library/ui/panel/preview/useCardPreview";

function makeCard(overrides: Partial<FSRSFlashcardItem["fsrs"]> = {}) {
	return {
		id: "card-1",
		question: "Q",
		answer: "A",
		cardType: "basic",
		fsrs: {
			id: "card-1",
			state: State.New,
			due: new Date(),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			...overrides,
		},
	} as unknown as FSRSFlashcardItem;
}

describe("isCardGradable", () => {
	it("returns true for a normal card", () => {
		expect(isCardGradable(makeCard())).toBe(true);
	});

	it("returns false when suspended", () => {
		expect(isCardGradable(makeCard({ suspended: true }))).toBe(false);
	});

	it("returns false when buried until a future date", () => {
		const future = new Date(Date.now() + 60_000).toISOString();
		expect(isCardGradable(makeCard({ buriedUntil: future }))).toBe(false);
	});

	it("returns true when buriedUntil is in the past", () => {
		const past = new Date(Date.now() - 60_000).toISOString();
		expect(isCardGradable(makeCard({ buriedUntil: past }))).toBe(true);
	});
});

describe("toPreviewIntervals", () => {
	it("flattens SchedulingPreview into interval strings", () => {
		const now = new Date();
		const result = toPreviewIntervals({
			again: { interval: "10m", due: now },
			hard: { interval: "3d", due: now },
			good: { interval: "5d", due: now },
			easy: { interval: "10d", due: now },
		});
		expect(result).toEqual({
			again: "10m",
			hard: "3d",
			good: "5d",
			easy: "10d",
		});
	});
});

describe("buildStandaloneReviewCommand", () => {
	const preset: FSRSPreset = { name: "default" } as FSRSPreset;
	const settings: FSRSSettings = {} as FSRSSettings;

	function makeFsrsService(): FSRSService {
		return {
			scheduleCard: (fsrs: { reps?: number }) => ({
				...fsrs,
				reps: (fsrs.reps ?? 0) + 1,
			}),
		} as unknown as FSRSService;
	}

	it("produces a ReviewAnswerCommand with previousIndex=null", () => {
		const cmd = buildStandaloneReviewCommand({
			card: makeCard(),
			rating: Rating.Good,
			fsrsService: makeFsrsService(),
			preset,
			settings,
		});
		expect(cmd.type).toBe("review:answer");
		expect(cmd.params.previousIndex).toBeNull();
		expect(cmd.params.rating).toBe(Rating.Good);
		expect(cmd.params.presetName).toBe("default");
	});

	it("captures wasNewCard for State.New cards", () => {
		const cmd = buildStandaloneReviewCommand({
			card: makeCard({ state: State.New }),
			rating: Rating.Easy,
			fsrsService: makeFsrsService(),
			preset,
			settings,
		});
		expect(cmd.params.wasNewCard).toBe(true);
	});

	it("wasNewCard is false for cards in Review state", () => {
		const cmd = buildStandaloneReviewCommand({
			card: makeCard({ state: State.Review }),
			rating: Rating.Hard,
			fsrsService: makeFsrsService(),
			preset,
			settings,
		});
		expect(cmd.params.wasNewCard).toBe(false);
	});
});
