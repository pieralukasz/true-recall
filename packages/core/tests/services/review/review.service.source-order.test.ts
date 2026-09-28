/**
 * Project sessions in tree order ("Study projects in tree order").
 *
 * With `sourceOrder` set, the queue goes through the project's notes from the
 * top of the tree down instead of mixing them, and daily limits keep the top.
 */

import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import type { RModeQueueOptions } from "../../../src/services/review/retrievability-queue";
import {
	type QueueBuildOptions,
	ReviewService,
} from "../../../src/services/review/review.service";
import type { FSRSFlashcardItem } from "../../../src/types";
import {
	createDefaultFSRSSettings,
	createMockFlashcard,
} from "../../mocks/fsrs.mocks";

const NOW = new Date("2024-06-15T10:00:00Z");
const DAY = 86_400_000;

/** top, middle, bottom: the order the project tree shows them in. */
const SOURCE_ORDER = new Map([
	["uid-top", 0],
	["uid-middle", 1],
	["uid-bottom", 2],
]);

function reviewCard(
	id: string,
	sourceUid: string,
	dueDaysAgo: number,
): FSRSFlashcardItem {
	return createMockFlashcard({
		id,
		sourceUid,
		fsrs: {
			state: State.Review,
			due: new Date(NOW.getTime() - dueDaysAgo * DAY).toISOString(),
			lastReview: new Date(
				NOW.getTime() - (dueDaysAgo + 5) * DAY,
			).toISOString(),
			stability: 5,
			difficulty: 5,
			scheduledDays: 5,
		},
	});
}

function newCard(
	id: string,
	sourceUid: string,
	createdAt: number,
): FSRSFlashcardItem {
	return createMockFlashcard({
		id,
		sourceUid,
		fsrs: { state: State.New, due: NOW.toISOString(), createdAt },
	});
}

function learningCard(
	id: string,
	sourceUid: string,
	dueOffsetMinutes: number,
): FSRSFlashcardItem {
	return createMockFlashcard({
		id,
		sourceUid,
		fsrs: {
			state: State.Learning,
			due: new Date(NOW.getTime() + dueOffsetMinutes * 60_000).toISOString(),
			stability: 0.4,
			difficulty: 5,
		},
	});
}

describe("buildQueue with sourceOrder (project tree order)", () => {
	let reviewService: ReviewService;
	let fsrsService: FSRSService;

	const base: QueueBuildOptions = {
		newCardsLimit: 20,
		reviewsLimit: 200,
		reviewedToday: new Set(),
		newCardsStudiedToday: 0,
		reviewsCompletedToday: 0,
		reviewOrder: "due-date",
		newCardOrder: "oldest-first",
	};

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		reviewService = new ReviewService();
		fsrsService = new FSRSService(createDefaultFSRSSettings());
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const ids = (queue: { id: string }[]) => queue.map((card) => card.id);

	it("groups cards by source from the top of the tree, keeping the order inside each source", () => {
		const cards = [
			reviewCard("bottom-r", "uid-bottom", 10),
			reviewCard("top-r-late", "uid-top", 1),
			reviewCard("middle-r", "uid-middle", 5),
			reviewCard("top-r-early", "uid-top", 3),
			newCard("top-n", "uid-top", 100),
			newCard("bottom-n", "uid-bottom", 50),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...base,
			newReviewMix: "mix-with-reviews",
			sourceOrder: SOURCE_ORDER,
		});

		expect(ids(queue)).toEqual([
			"top-r-early",
			"top-r-late",
			"top-n",
			"middle-r",
			"bottom-r",
			"bottom-n",
		]);
	});

	it("mixes sources when sourceOrder is not set", () => {
		const cards = [
			reviewCard("bottom-r", "uid-bottom", 10),
			reviewCard("top-r", "uid-top", 1),
			reviewCard("middle-r", "uid-middle", 5),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, base);

		expect(ids(queue)).toEqual(["bottom-r", "middle-r", "top-r"]);
	});

	it("fills the review limit from the top of the tree", () => {
		const cards = [
			reviewCard("bottom-r", "uid-bottom", 30),
			reviewCard("middle-r", "uid-middle", 20),
			reviewCard("top-r1", "uid-top", 2),
			reviewCard("top-r2", "uid-top", 1),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...base,
			reviewsLimit: 3,
			sourceOrder: SOURCE_ORDER,
		});

		expect(ids(queue)).toEqual(["top-r1", "top-r2", "middle-r"]);
	});

	it("fills the new card limit from the top of the tree", () => {
		const cards = [
			newCard("bottom-n", "uid-bottom", 1),
			newCard("middle-n", "uid-middle", 2),
			newCard("top-n", "uid-top", 3),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...base,
			newCardsLimit: 2,
			sourceOrder: SOURCE_ORDER,
		});

		expect(ids(queue)).toEqual(["top-n", "middle-n"]);
	});

	it("still shows due learning cards first and pending learning cards last", () => {
		const cards = [
			reviewCard("top-r", "uid-top", 1),
			learningCard("bottom-due", "uid-bottom", -5),
			learningCard("top-pending", "uid-top", 30),
			reviewCard("middle-r", "uid-middle", 1),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...base,
			sourceOrder: SOURCE_ORDER,
		});

		expect(ids(queue)).toEqual([
			"bottom-due",
			"top-r",
			"middle-r",
			"top-pending",
		]);
	});

	it("puts cards from sources outside the order last", () => {
		const cards = [
			reviewCard("stray", "uid-stray", 10),
			reviewCard("middle-r", "uid-middle", 1),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...base,
			sourceOrder: SOURCE_ORDER,
		});

		expect(ids(queue)).toEqual(["middle-r", "stray"]);
	});

	it("orders an R-Mode session by tree after picking the cards", () => {
		const rMode: RModeQueueOptions = {
			targetCount: 10,
			comfortMix: 0,
			ceiling: 0.99,
			comfortFloor: 0.9,
			urgentBelow: 0.5,
		};
		const cards = [
			reviewCard("bottom-r", "uid-bottom", 40),
			reviewCard("top-r", "uid-top", 2),
			reviewCard("middle-r", "uid-middle", 20),
		];

		const queue = reviewService.buildQueue(cards, fsrsService, {
			...base,
			rMode,
			sourceOrder: SOURCE_ORDER,
		});

		expect(ids(queue)).toEqual(["top-r", "middle-r", "bottom-r"]);
	});
});
