import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockFlashcard } from "../../../../../../core/tests/mocks/fsrs.mocks";
import { CardActionsHandler } from "../../../../../src/features/study/ui/review/handlers/CardActionsHandler";
import type { ReviewApi } from "../../../../../src/store";

const notificationSpies = vi.hoisted(() => ({
	warning: vi.fn(),
	cardForgotten: vi.fn(),
	cardsForgotten: vi.fn(),
}));

vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => ({
		warning: notificationSpies.warning,
		cardForgotten: notificationSpies.cardForgotten,
		cardsForgotten: notificationSpies.cardsForgotten,
	}),
}));

vi.mock("../../../../../src/services/signals", () => ({
	notifyCardChange: vi.fn(),
}));

vi.mock("@true-recall/core/ui/modals", () => ({
	MoveCardModal: class {},
}));

vi.mock(
	"../../../../../src/features/study/modals/quick-note-editor/QuickNoteEditorModal",
	() => ({
		QuickNoteEditorModal: class {},
	}),
);

vi.mock("@true-recall/obsidian/data", () => ({
	mutate: vi.fn((_type: string, fn: () => void) => fn()),
}));

function createMockCommandService(ctx: {
	cardStore: any;
	sessionPersistence: any;
}) {
	return {
		execute: vi.fn(async (cmd: any) => {
			if (typeof cmd.execute === "function") {
				cmd.execute({
					cardStore: ctx.cardStore,
					sessionPersistence: ctx.sessionPersistence,
					flashcardManager: {},
				});
			}
		}),
		canUndo: vi.fn(() => false),
	};
}

describe("CardActionsHandler.handleForget", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		notificationSpies.warning.mockReset();
		notificationSpies.cardForgotten.mockReset();
		notificationSpies.cardsForgotten.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("warns and does nothing for New current card", async () => {
		const currentCard = createMockFlashcard({
			id: "new-current",
			fsrs: { state: State.New },
		});
		const removeCardById = vi.fn();
		const bulkForget = vi.fn();

		const review = {
			currentIndex: 0,
			getCurrentCard: () => currentCard,
			removeCardById,
			isComplete: () => false,
		} as unknown as ReviewApi;

		const handler = new CardActionsHandler(
			{
				app: {} as never,
				getReview: () => review,
				flashcardManager: {} as never,
				fsrsService: {} as never,
				reviewService: {} as never,
				cardStore: {
					get: vi.fn(),
					cards: {
						bulkForget,
						getCardByReverseOf: vi.fn(),
					},
				} as never,
				settings: {} as never,
				plugin: { sessionPersistence: null, commandService: null } as never,
			},
			{ onUpdateSchedulingPreview: vi.fn() },
		);

		handler.handleForget();

		expect(notificationSpies.warning).toHaveBeenCalledWith(
			"Forget is only available for cards that are not New.",
		);
		expect(removeCardById).not.toHaveBeenCalled();
		expect(bulkForget).not.toHaveBeenCalled();
	});

	it("forgets only non-New siblings and keeps New siblings in queue", async () => {
		const currentCard = createMockFlashcard({
			id: "review-current",
			cardType: "reversed",
			reverseOf: "new-sibling",
			fsrs: { state: State.Review },
		});
		const removeCardsByIds = vi.fn();
		const bulkForget = vi.fn(() => 1);
		const removeReviewedCards = vi.fn();
		const onUpdateSchedulingPreview = vi.fn();

		const review = {
			currentIndex: 2,
			queue: [currentCard],
			getCurrentCard: () => currentCard,
			removeCardsByIds,
			isComplete: () => false,
		} as unknown as ReviewApi;

		const cardStore = {
			get: vi.fn((id: string) =>
				id === "new-sibling" ? { state: State.New } : { state: State.Review },
			),
			cards: {
				bulkForget,
				getCardByReverseOf: vi.fn(),
			},
			stats: {
				getReviewedCardIds: vi.fn(() => []),
				recordReviewedCard: vi.fn(),
			},
		} as never;

		const sessionPersistence = {
			getTodayKey: vi.fn(() => "2026-05-02"),
			removeReviewedCards,
		};

		const commandService = createMockCommandService({
			cardStore,
			sessionPersistence,
		});

		const handler = new CardActionsHandler(
			{
				app: {} as never,
				getReview: () => review,
				flashcardManager: {} as never,
				fsrsService: {} as never,
				reviewService: {} as never,
				cardStore,
				settings: {} as never,
				plugin: {
					sessionPersistence,
					commandService,
				} as never,
			},
			{ onUpdateSchedulingPreview },
		);

		handler.handleForget();

		// Command is executed, which calls removeCardsByIds for the card
		expect(removeCardsByIds).toHaveBeenCalledTimes(1);
		expect(removeCardsByIds).toHaveBeenCalledWith(["review-current"]);
		expect(onUpdateSchedulingPreview).toHaveBeenCalledTimes(1);
		expect(notificationSpies.cardForgotten).toHaveBeenCalledTimes(1);
		expect(notificationSpies.warning).not.toHaveBeenCalled();

		// doWrite is deferred in setTimeout(0), advance timers to trigger it
		vi.runAllTimers();

		expect(bulkForget).toHaveBeenCalledWith(["review-current"]);
		expect(removeReviewedCards).toHaveBeenCalledWith(["review-current"]);
	});
});
