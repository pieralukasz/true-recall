import { Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { preparePreviewAnswer } from "../../../src/services/review/review-session.engine";
import { createMockFlashcard } from "../../mocks/fsrs.mocks";

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
