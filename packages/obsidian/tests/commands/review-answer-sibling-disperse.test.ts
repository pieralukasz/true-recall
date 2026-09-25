import { describe, expect, it, vi } from "vitest";

import type { FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import { ReviewAnswerCommand } from "@true-recall/obsidian/commands/commands/review-answer.cmd";
import { patchCardDues } from "@true-recall/obsidian/data";

vi.mock("@true-recall/obsidian/data", () => ({
	mutateReviewGrade: vi.fn(),
	patchNoteTags: vi.fn(),
	patchCardDues: vi.fn(),
}));

const SIBLING_CHANGE = {
	cardId: "sibling-1",
	originalDue: "2026-02-11T10:00:00.000Z",
	newDue: "2026-02-13T10:00:00.000Z",
};

function makeCard(): FSRSFlashcardItem {
	return {
		id: "card-1",
		question: "Q",
		answer: "A",
		cardType: "basic",
		sourceUid: "note-1",
		fsrs: {
			id: "card-1",
			state: 2,
			due: "2026-02-05T10:00:00.000Z",
			stability: 5,
			difficulty: 5,
			scheduledDays: 4,
			reps: 3,
			lapses: 0,
			lastReview: null,
			learningStep: 0,
		} as FSRSCardData,
	} as FSRSFlashcardItem;
}

function makeCtx(overrides?: Partial<CommandContext>) {
	const updateCardDue = vi.fn();
	const ctx: CommandContext = {
		flashcardManager: {
			updateCardFSRS: vi.fn().mockReturnValue(true),
		} as unknown as CommandContext["flashcardManager"],
		cardStore: {
			transaction: vi.fn((operation: () => unknown) => operation()),
			cards: { updateCardDue },
		} as unknown as CommandContext["cardStore"],
		sessionPersistence: {
			recordReview: vi.fn(),
			removeLastReview: vi.fn(),
		} as unknown as CommandContext["sessionPersistence"],
		...overrides,
	};
	return { ctx, updateCardDue };
}

function makeCommand(disperseSiblings?: () => (typeof SIBLING_CHANGE)[]) {
	const card = makeCard();
	return new ReviewAnswerCommand({
		card,
		originalFsrs: { ...card.fsrs },
		updatedFsrs: { ...card.fsrs, due: "2026-02-10T10:00:00.000Z" },
		previousIndex: null,
		wasNewCard: false,
		rating: 3,
		previousState: 2,
		scheduledDays: 9,
		elapsedDays: 4,
		responseTime: 1000,
		presetName: "default",
		disperseSiblings,
	});
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("ReviewAnswerCommand — automatic sibling dispersal", () => {
	it("disperses siblings inside the answer's write and patches the cache", async () => {
		vi.mocked(patchCardDues).mockClear();
		const { ctx } = makeCtx();
		const disperse = vi.fn(() => [SIBLING_CHANGE]);
		const cmd = makeCommand(disperse);

		cmd.execute(ctx);
		await flush();

		expect(disperse).toHaveBeenCalledOnce();
		// Runs after the card itself is saved, in the same transaction
		expect(ctx.cardStore.transaction).toHaveBeenCalledOnce();
		expect(
			vi.mocked(ctx.flashcardManager.updateCardFSRS).mock
				.invocationCallOrder[0],
		).toBeLessThan(disperse.mock.invocationCallOrder[0] ?? 0);
		expect(patchCardDues).toHaveBeenCalledWith([
			{ cardId: "sibling-1", due: "2026-02-13T10:00:00.000Z" },
		]);
	});

	it("undo puts the dispersed siblings back", async () => {
		vi.mocked(patchCardDues).mockClear();
		const { ctx, updateCardDue } = makeCtx();
		const cmd = makeCommand(() => [SIBLING_CHANGE]);

		cmd.execute(ctx);
		await flush();
		cmd.undo(ctx);

		expect(updateCardDue).toHaveBeenCalledWith(
			"sibling-1",
			"2026-02-11T10:00:00.000Z",
		);
		expect(patchCardDues).toHaveBeenLastCalledWith([
			{ cardId: "sibling-1", due: "2026-02-11T10:00:00.000Z" },
		]);
	});

	it("does not disperse when the answer is undone before the write fires", () => {
		const { ctx } = makeCtx();
		const disperse = vi.fn(() => [SIBLING_CHANGE]);
		const cmd = makeCommand(disperse);

		cmd.execute(ctx);
		cmd.undo(ctx);

		expect(disperse).not.toHaveBeenCalled();
	});

	it("touches nothing extra when no sibling moved", async () => {
		vi.mocked(patchCardDues).mockClear();
		const { ctx, updateCardDue } = makeCtx();
		const cmd = makeCommand(() => []);

		cmd.execute(ctx);
		await flush();
		cmd.undo(ctx);

		expect(patchCardDues).not.toHaveBeenCalled();
		expect(updateCardDue).not.toHaveBeenCalled();
	});
});
