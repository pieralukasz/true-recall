import { CardActionsHandler } from "@features/study/ui/review/handlers/CardActionsHandler";
import type { ReviewApi } from "@shared/store";
import { createMockFlashcard } from "../../services/mocks/fsrs.mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { State } from "ts-fsrs";

const notificationSpies = vi.hoisted(() => ({
	warning: vi.fn(),
	cardForgotten: vi.fn(),
	cardsForgotten: vi.fn(),
}));

const signalSpies = vi.hoisted(() => ({
	notifyCardChange: vi.fn(),
}));

vi.mock("@shared/services/notification.service", () => ({
	notify: () => ({
		warning: notificationSpies.warning,
		cardForgotten: notificationSpies.cardForgotten,
		cardsForgotten: notificationSpies.cardsForgotten,
	}),
}));

vi.mock("@shared/services/signals", () => ({
	notifyCardChange: signalSpies.notifyCardChange,
}));

vi.mock("@shared/ui/modals", () => ({
	MoveCardModal: class {},
}));

vi.mock(
	"@features/study/modals/quick-note-editor/QuickNoteEditorModal",
	() => ({
		QuickNoteEditorModal: class {},
	}),
);

describe("CardActionsHandler.handleForget", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		notificationSpies.warning.mockReset();
		notificationSpies.cardForgotten.mockReset();
		notificationSpies.cardsForgotten.mockReset();
		signalSpies.notifyCardChange.mockReset();
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
				plugin: { sessionPersistence: null, undoService: null } as never,
			},
			{ onUpdateSchedulingPreview: vi.fn() },
		);

		await handler.handleForget();
		vi.runAllTimers();

		expect(notificationSpies.warning).toHaveBeenCalledWith(
			"Forget is only available for cards that are not New.",
		);
		expect(removeCardById).not.toHaveBeenCalled();
		expect(bulkForget).not.toHaveBeenCalled();
		expect(signalSpies.notifyCardChange).not.toHaveBeenCalled();
	});

	it("forgets only non-New siblings and keeps New siblings in queue", async () => {
		const currentCard = createMockFlashcard({
			id: "review-current",
			cardType: "reversed",
			reverseOf: "new-sibling",
			fsrs: { state: State.Review },
		});
		const removeCardById = vi.fn();
		const bulkForget = vi.fn(() => 1);
		const removeReviewedCards = vi.fn();
		const onUpdateSchedulingPreview = vi.fn();

		const review = {
			currentIndex: 2,
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
					get: vi.fn((id: string) =>
						id === "new-sibling" ? { state: State.New } : { state: State.Review },
					),
					cards: {
						bulkForget,
						getCardByReverseOf: vi.fn(),
					},
				} as never,
				settings: {} as never,
				plugin: {
					sessionPersistence: { removeReviewedCards },
					undoService: null,
				} as never,
			},
			{ onUpdateSchedulingPreview },
		);

		await handler.handleForget();

		expect(removeCardById).toHaveBeenCalledTimes(1);
		expect(removeCardById).toHaveBeenCalledWith("review-current");
		expect(onUpdateSchedulingPreview).toHaveBeenCalledTimes(1);
		expect(notificationSpies.cardForgotten).toHaveBeenCalledTimes(1);
		expect(notificationSpies.warning).not.toHaveBeenCalled();

		vi.runAllTimers();

		expect(bulkForget).toHaveBeenCalledWith(["review-current"]);
		expect(removeReviewedCards).toHaveBeenCalledWith(["review-current"]);
		expect(signalSpies.notifyCardChange).toHaveBeenCalledWith({
			type: "bulk",
			cardIds: ["review-current"],
			action: "reset",
		});
	});
});
