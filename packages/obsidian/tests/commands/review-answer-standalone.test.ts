import { describe, expect, it, vi } from "vitest";

import type { FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import { ReviewAnswerCommand } from "@true-recall/obsidian/commands/commands/review-answer.cmd";

vi.mock("@true-recall/obsidian/data", () => ({
	mutateReviewGrade: vi.fn(),
}));

function makeCard(): FSRSFlashcardItem {
	return {
		id: "card-1",
		question: "Q",
		answer: "A",
		cardType: "basic",
		fsrs: {
			id: "card-1",
			state: 0,
			due: new Date(),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
		} as FSRSCardData,
	} as FSRSFlashcardItem;
}

function makeCtx(overrides?: Partial<CommandContext>): CommandContext {
	return {
		flashcardManager: {
			updateCardFSRS: vi.fn().mockReturnValue(true),
		} as unknown as CommandContext["flashcardManager"],
		cardStore: {
			transaction: vi.fn((operation: () => unknown) => operation()),
		} as unknown as CommandContext["cardStore"],
		sessionPersistence: {
			recordReview: vi.fn(),
			removeLastReview: vi.fn(),
		} as unknown as CommandContext["sessionPersistence"],
		...overrides,
	};
}

describe("ReviewAnswerCommand — standalone (no queue)", () => {
	it("executes and records review without queue context (previousIndex=null)", async () => {
		const ctx = makeCtx();
		const card = makeCard();
		const cmd = new ReviewAnswerCommand({
			card,
			originalFsrs: { ...card.fsrs },
			updatedFsrs: { ...card.fsrs, reps: 1 },
			previousIndex: null,
			wasNewCard: true,
			rating: 3,
			previousState: 0,
			scheduledDays: 1,
			elapsedDays: 0,
			responseTime: 1000,
			presetName: "default",
		});

		cmd.execute(ctx);
		await new Promise((r) => setTimeout(r, 5));

		expect(ctx.flashcardManager.updateCardFSRS).toHaveBeenCalledWith(
			"card-1",
			expect.objectContaining({ reps: 1 }),
			undefined,
			{ skipNotification: true },
		);
		expect(ctx.sessionPersistence.recordReview).toHaveBeenCalled();
	});

	it("undo restores original fsrs when previousIndex is null", async () => {
		const ctx = makeCtx();
		const card = makeCard();
		const cmd = new ReviewAnswerCommand({
			card,
			originalFsrs: { ...card.fsrs },
			updatedFsrs: { ...card.fsrs, reps: 1 },
			previousIndex: null,
			wasNewCard: true,
			rating: 3,
			previousState: 0,
			scheduledDays: 1,
			elapsedDays: 0,
			responseTime: 1000,
			presetName: "default",
		});

		cmd.execute(ctx);
		await new Promise((r) => setTimeout(r, 5));
		cmd.undo(ctx);

		expect(ctx.flashcardManager.updateCardFSRS).toHaveBeenLastCalledWith(
			"card-1",
			expect.objectContaining({ reps: 0 }),
			undefined,
			{ skipNotification: true },
		);
		expect(ctx.sessionPersistence.removeLastReview).toHaveBeenCalled();
	});
});

describe("ReviewAnswerCommand — persistence rollback", () => {
	it("restores session state and skips post-commit effects when the transaction fails", async () => {
		const card = makeCard();
		const sibling = { ...makeCard(), id: "sibling" };
		const insertCardAtPosition = vi.fn();
		const undoLastAnswer = vi.fn();
		const onPersisted = vi.fn();
		const onFailure = vi.fn();
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const ctx = makeCtx({
			sessionPersistence: {
				recordReview: vi.fn(() => {
					throw new Error("review log write failed");
				}),
				removeLastReview: vi.fn(),
			} as unknown as CommandContext["sessionPersistence"],
		});
		const cmd = new ReviewAnswerCommand({
			card,
			originalFsrs: { ...card.fsrs },
			updatedFsrs: { ...card.fsrs, reps: 1 },
			previousIndex: 0,
			wasNewCard: true,
			rating: 3,
			previousState: 0,
			scheduledDays: 1,
			elapsedDays: 0,
			responseTime: 1000,
			presetName: "default",
			buriedSiblings: [sibling],
			getReview: () =>
				({
					queue: [],
					insertCardAtPosition,
					undoLastAnswer,
				}) as never,
			onPersisted,
		});
		cmd.onDeferredFailure(onFailure);

		cmd.execute(ctx);
		await new Promise((resolve) => setTimeout(resolve, 5));

		expect(insertCardAtPosition).toHaveBeenCalledWith(sibling, 0);
		expect(undoLastAnswer).toHaveBeenCalledWith(
			0,
			expect.objectContaining({ id: card.id, fsrs: card.fsrs }),
			undefined,
		);
		expect(onPersisted).not.toHaveBeenCalled();
		expect(onFailure).toHaveBeenCalledOnce();
		errorSpy.mockRestore();
	});
});
