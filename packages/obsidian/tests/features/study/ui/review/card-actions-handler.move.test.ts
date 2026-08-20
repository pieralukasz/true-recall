import { describe, expect, it, vi } from "vitest";

import { createMockFlashcard } from "../../../../../../core/tests/mocks/fsrs.mocks";
import { CardActionsHandler } from "../../../../../src/features/study/ui/review/handlers/CardActionsHandler";
import type { ReviewApi } from "../../../../../src/store";

const modalSpies = vi.hoisted(() => ({
	openAndWait: vi.fn(async () => ({
		cancelled: false,
		targetNotePath: "Target.md",
	})),
}));

const notificationSpies = vi.hoisted(() => ({
	cardGradedAndMoved: vi.fn(),
	warning: vi.fn(),
	operationFailed: vi.fn(),
}));

vi.mock("@true-recall/obsidian/modals/shared", () => ({
	MoveCardModal: class {
		openAndWait = modalSpies.openAndWait;
	},
}));

vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => notificationSpies,
}));

describe("CardActionsHandler.handleMoveCard", () => {
	it("does not remove the next card when grading already evicted the moved card", async () => {
		const movedCard = createMockFlashcard({ id: "moved-card" });
		const nextCard = createMockFlashcard({ id: "next-card" });
		let queue = [movedCard, nextCard];
		const removeCurrentCard = vi.fn(() => {
			queue = queue.slice(1);
		});
		const removeCardById = vi.fn((cardId: string) => {
			queue = queue.filter((card) => card.id !== cardId);
		});
		const review = {
			queue,
			getCurrentCard: () => queue[0] ?? null,
			removeCurrentCard,
			removeCardById,
			isComplete: () => false,
			getSessionFilters: () => ({}),
		} as unknown as ReviewApi;

		const gradeCard = vi.fn(() => {
			// card:updated/card:reviewed signals synchronously remove the graded card
			// from a live review queue before moveCard() resolves.
			removeCardById(movedCard.id);
			return { persisted: true };
		});
		const moveCard = vi.fn(async () => true);
		const removeCardsFromTemporaryDeck = vi.fn();

		const handler = new CardActionsHandler(
			{
				app: {} as never,
				getReview: () => review,
				flashcardManager: { moveCard } as never,
				fsrsService: {} as never,
				reviewService: { gradeCard } as never,
				cardStore: {} as never,
				settings: {} as never,
				plugin: {
					commandService: null,
					removeCardsFromTemporaryDeck,
				} as never,
			},
			{ onUpdateSchedulingPreview: vi.fn() },
		);

		await handler.handleMoveCard();

		expect(moveCard).toHaveBeenCalledWith("moved-card", "Target.md");
		expect(removeCardById).toHaveBeenLastCalledWith("moved-card");
		expect(removeCurrentCard).not.toHaveBeenCalled();
		expect(queue.map((card) => card.id)).toEqual(["next-card"]);
		expect(notificationSpies.cardGradedAndMoved).toHaveBeenCalledOnce();
	});
});
