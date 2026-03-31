import { describe, expect, it } from "vitest";
import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import {
	ReviewService,
	type QueueBuildOptions,
} from "../../../src/services/review/review.service";
import { createDefaultFSRSSettings, createMockFlashcard } from "../../mocks/fsrs.mocks";
import { State } from "ts-fsrs";

describe("ReviewService sourceUidFilter", () => {
	const options: QueueBuildOptions = {
		newCardsLimit: 20,
		reviewsLimit: 200,
		reviewedToday: new Set(),
		newCardsStudiedToday: 0,
		reviewsCompletedToday: 0,
	};

	it("filters queue by source UID even if source note names are empty or mismatched", () => {
		const reviewService = new ReviewService();
		const fsrsService = new FSRSService(createDefaultFSRSSettings());

		const cards = [
			createMockFlashcard({
				id: "target",
				sourceUid: "uid-target",
				sourceNoteName: "",
				fsrs: { state: State.New },
			}),
			createMockFlashcard({
				id: "other",
				sourceUid: "uid-other",
				sourceNoteName: "Same basename",
				fsrs: { state: State.New },
			}),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...options,
			sourceUidFilter: new Set(["uid-target"]),
		});

		expect(queue.map((card) => card.id)).toEqual(["target"]);
	});

	it("excludes cards without sourceUid when sourceUidFilter is active", () => {
		const reviewService = new ReviewService();
		const fsrsService = new FSRSService(createDefaultFSRSSettings());

		const cards = [
			createMockFlashcard({
				id: "no-uid",
				sourceUid: undefined,
				fsrs: { state: State.New },
			}),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...options,
			sourceUidFilter: new Set(["uid-target"]),
		});

		expect(queue).toHaveLength(0);
	});
});
