import { describe, expect, it, vi } from "vitest";

import type { FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import { ReviewAnswerCommand } from "@true-recall/obsidian/commands/commands/review-answer.cmd";
import { patchNoteTags } from "@true-recall/obsidian/data";

vi.mock("@true-recall/obsidian/data", () => ({
	mutateReviewGrade: vi.fn(),
	patchNoteTags: vi.fn(),
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

describe("ReviewAnswerCommand — leech tag", () => {
	function makeNoteStore(initialTags: string[]) {
		const note = { id: "note-1", tags: [...initialTags] };
		return {
			note,
			notes: {
				getById: vi.fn((id: string) =>
					id === note.id ? { ...note, tags: [...note.tags] } : null,
				),
				update: vi.fn((_id: string, updates: { tags?: string[] }) => {
					if (updates.tags) note.tags = [...updates.tags];
				}),
			},
		};
	}

	function makeLeechCommand(addLeechTag: boolean) {
		const card = { ...makeCard(), noteId: "note-1", tags: ["biology"] };
		return new ReviewAnswerCommand({
			card,
			originalFsrs: { ...card.fsrs },
			updatedFsrs: { ...card.fsrs, lapses: 8 },
			previousIndex: null,
			wasNewCard: false,
			rating: 1,
			previousState: 2,
			scheduledDays: 0,
			elapsedDays: 1,
			responseTime: 1000,
			presetName: "default",
			addLeechTag,
		});
	}

	function makeLeechCtx(store: ReturnType<typeof makeNoteStore>) {
		return makeCtx({
			cardStore: {
				transaction: vi.fn((operation: () => unknown) => operation()),
				notes: store.notes,
			} as unknown as CommandContext["cardStore"],
		});
	}

	it("adds the leech tag to the note, keeping existing tags, and patches the cache", async () => {
		const store = makeNoteStore(["biology", "hard"]);
		const cmd = makeLeechCommand(true);

		cmd.execute(makeLeechCtx(store));
		await new Promise((r) => setTimeout(r, 5));

		expect(store.note.tags).toEqual(["biology", "hard", "leech"]);
		expect(store.notes.update).toHaveBeenCalledWith(
			"note-1",
			{ tags: ["biology", "hard", "leech"] },
			"system",
		);
		expect(patchNoteTags).toHaveBeenCalledWith("note-1", [
			"biology",
			"hard",
			"leech",
		]);
	});

	it("undo removes the leech tag it added", async () => {
		const store = makeNoteStore(["biology"]);
		const cmd = makeLeechCommand(true);
		const ctx = makeLeechCtx(store);

		cmd.execute(ctx);
		await new Promise((r) => setTimeout(r, 5));
		cmd.undo(ctx);

		expect(store.note.tags).toEqual(["biology"]);
	});

	it.each([
		["already tagged", ["leech"], true],
		["not a leech answer", ["biology"], false],
	])("does not write tags when %s", async (_label, tags, addLeechTag) => {
		const store = makeNoteStore(tags);
		const cmd = makeLeechCommand(addLeechTag);
		const ctx = makeLeechCtx(store);

		cmd.execute(ctx);
		await new Promise((r) => setTimeout(r, 5));
		cmd.undo(ctx);

		expect(store.notes.update).not.toHaveBeenCalled();
		expect(store.note.tags).toEqual(tags);
	});
});
