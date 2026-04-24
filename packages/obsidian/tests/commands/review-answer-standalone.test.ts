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
		cardStore: {} as CommandContext["cardStore"],
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
		);
		expect(ctx.sessionPersistence.removeLastReview).toHaveBeenCalled();
	});
});
