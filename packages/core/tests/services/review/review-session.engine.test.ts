import { type Grade, Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { LEECH_TAG } from "../../../src/helpers/leech-helpers";
import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import { ReviewService } from "../../../src/services/review/review.service";
import {
	preparePreviewAnswer,
	ReviewSessionEngine,
} from "../../../src/services/review/review-session.engine";
import type { LeechAction } from "../../../src/types/settings.types";
import {
	createDefaultFSRSSettings,
	createMockFlashcard,
} from "../../mocks/fsrs.mocks";

const NOW = new Date("2024-01-15T10:00:00.000Z");

describe("preparePreviewAnswer", () => {
	it.each([
		[Rating.Again, 60],
		[Rating.Hard, 600],
	] as const)("requeues rating %s after %s seconds", (rating, seconds) => {
		const card = createMockFlashcard({
			id: "preview-card",
			fsrs: { state: State.Review, due: "2024-02-01T00:00:00.000Z" },
		});

		const transition = preparePreviewAnswer(card, rating, 12, NOW);

		expect(transition.answeredCard.fsrs).toEqual(card.fsrs);
		expect(transition.requeueData?.position).toBe(12);
		expect(transition.requeueData?.card.previewDue).toBe(
			new Date(NOW.getTime() + seconds * 1000).toISOString(),
		);
	});

	it.each([
		Rating.Good,
		Rating.Easy,
	])("finishes rating %s without rescheduling the card", (rating) => {
		const card = createMockFlashcard({
			previewDue: "2024-01-15T09:00:00.000Z",
		});

		const transition = preparePreviewAnswer(card, rating, 1, NOW);

		expect(transition.answeredCard.previewDue).toBeUndefined();
		expect(transition.answeredCard.fsrs).toEqual(card.fsrs);
		expect(transition.requeueData).toBeUndefined();
	});
});

describe("ReviewSessionEngine.prepareAnswer leech handling", () => {
	const engine = new ReviewSessionEngine();
	const fsrsService = new FSRSService(createDefaultFSRSSettings());
	const reviewService = new ReviewService();

	// A review card on its 7th lapse: failing it makes 8 lapses (threshold 8).
	function answerAgain(
		leechAction: LeechAction,
		overrides: { tags?: string[]; lapses?: number; skip?: boolean } = {},
	) {
		const card = createMockFlashcard({
			id: "leech-card",
			tags: overrides.tags,
			fsrs: {
				state: State.Review,
				lapses: overrides.lapses ?? 7,
				reps: 20,
				stability: 5,
				difficulty: 8,
				due: "2024-01-15T09:00:00.000Z",
				lastReview: "2024-01-10T09:00:00.000Z",
			},
		});
		return engine.prepareAnswer(
			card,
			Rating.Again as Grade,
			fsrsService,
			[card],
			1,
			{
				responseTime: 1000,
				leechThreshold: 8,
				leechAction,
				skipLeechSuspend: overrides.skip,
			},
			reviewService,
		);
	}

	it("tag-only adds the leech tag without suspending", () => {
		const transition = answerAgain("tag-only", { tags: ["biology"] });

		expect(transition.leechTagged).toBe(true);
		expect(transition.leechSuspended).toBe(false);
		expect(transition.updatedCard.tags).toEqual(["biology", LEECH_TAG]);
		expect(transition.updatedCard.fsrs.suspended).not.toBe(true);
	});

	it("suspend adds the leech tag and suspends", () => {
		const transition = answerAgain("suspend");

		expect(transition.leechTagged).toBe(true);
		expect(transition.leechSuspended).toBe(true);
		expect(transition.updatedCard.tags).toEqual([LEECH_TAG]);
		expect(transition.updatedCard.fsrs.suspended).toBe(true);
	});

	it("does not tag again when the note already has the leech tag", () => {
		const transition = answerAgain("tag-only", { tags: [LEECH_TAG] });

		expect(transition.leechTagged).toBe(false);
		expect(transition.updatedCard.tags).toEqual([LEECH_TAG]);
	});

	it.each([
		["below the threshold", { lapses: 5 }],
		["in a transient (cramming) session", { skip: true }],
	])("leaves tags alone %s", (_label, overrides) => {
		const transition = answerAgain("tag-only", { tags: [], ...overrides });

		expect(transition.leechTagged).toBe(false);
		expect(transition.leechSuspended).toBe(false);
		expect(transition.updatedCard.tags).toEqual([]);
	});
});
