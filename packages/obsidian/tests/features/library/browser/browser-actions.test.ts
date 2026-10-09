import { State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import { DuplicateQuestionError } from "@true-recall/core/flashcard/data/card-repository.service";
import type { Note, NoteType } from "@true-recall/core/types/note.types";

import type { Command } from "@true-recall/obsidian/commands/command.types";
import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import {
	MoveCardCommand,
	MoveCardsCommand,
} from "@true-recall/obsidian/commands/commands/card-move.cmd";
import { UpdateCardCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";
import {
	type BrowserActionDeps,
	editCard,
	moveCard,
	moveCards,
	reconcilePreviewCard,
	removeOrphanedCards,
	saveCardContent,
} from "@true-recall/obsidian/features/library/ui/browser/helpers/browser-actions";
import type { BrowserCard } from "@true-recall/obsidian/features/library/ui/browser/types";

function createMockBrowserCard(
	overrides: Partial<BrowserCard> = {},
): BrowserCard {
	return {
		id: "card-1",
		question: "Q",
		answer: "A",
		state: State.New,
		due: new Date(0).toISOString(),
		stability: 0,
		difficulty: 0,
		reps: 0,
		lapses: 0,
		scheduledDays: 0,
		lastReview: null,
		createdAt: null,
		suspended: false,
		buriedUntil: null,
		flag: 0,
		sourceUid: "uid-1",
		sourceNoteName: "Biology",
		sourceNotePath: "Biology.md",
		cardType: "basic",
		createdVia: "manual",
		editCount: 0,
		aiEditCount: 0,
		contentEditedAt: null,
		presetName: null,
		projects: [],
		...overrides,
	};
}

/**
 * In-memory stand-in for the plugin. `executeCommand` runs the command against
 * a fake context so commands behave as they would through the CommandService.
 */
function createDeps(overrides: Partial<BrowserActionDeps> = {}) {
	const store = new Map<string, BrowserCard>();
	const executed: Command[] = [];
	const moveCardImpl = vi.fn(async (cardId: string) => store.has(cardId));
	const removeImpl = vi.fn((ids: string[]) => {
		const present = ids.filter((id) => store.has(id));
		for (const id of present) store.delete(id);
		return { affectedCount: present.length, deletedCardsData: [] };
	});

	const commandCtx = {
		flashcardManager: {
			moveCard: moveCardImpl,
			removeFlashcardsByIdsWithDetails: removeImpl,
		},
		cardStore: {
			get: (id: string) => store.get(id),
			cards: { updateCardSourceUid: vi.fn() },
		},
		sessionPersistence: {},
	} as never;

	const notify = {
		warning: vi.fn(),
		error: vi.fn(),
		operationFailed: vi.fn(),
		duplicateQuestion: vi.fn(
			(error: unknown) => error instanceof DuplicateQuestionError,
		),
		cardsMoved: vi.fn(),
		cardsDeletedWithUndo: vi.fn(),
	};

	const deps: BrowserActionDeps = {
		updateCardContent: vi.fn((cardId, question, answer) => {
			const card = store.get(cardId);
			if (card) store.set(cardId, { ...card, question, answer });
		}),
		executeCommand: vi.fn(async (command: Command) => {
			executed.push(command);
			await command.execute(commandCtx);
		}),
		undo: vi.fn(),
		getBrowserCard: (id) => store.get(id) ?? null,
		getOrphanedCardIds: vi.fn(() => []),
		confirm: vi.fn(async () => true),
		pickMoveTarget: vi.fn(async () => "Target.md"),
		resolveEditTarget: vi.fn(() => ({
			ok: true as const,
			note: { id: "note-1" } as Note,
			noteType: { id: "basic" } as NoteType,
		})),
		openEditor: vi.fn(async () => {}),
		notify,
		...overrides,
	};

	return { deps, store, executed, notify, moveCardImpl };
}

describe("saveCardContent", () => {
	it("writes the edited field, keeps the other and registers an undo entry", async () => {
		const { deps, store, executed } = createDeps();
		const card = createMockBrowserCard();
		store.set(card.id, card);

		const next = await saveCardContent(deps, card, "New Q", "question");

		expect(deps.updateCardContent).toHaveBeenCalledWith("card-1", "New Q", "A");
		expect(next?.question).toBe("New Q");
		expect(next?.answer).toBe("A");
		expect(executed).toHaveLength(1);
		expect(executed[0]).toBeInstanceOf(UpdateCardCommand);
	});

	it("bases the untouched field on the stored card, not the preview snapshot", async () => {
		const { deps, store } = createDeps();
		const snapshot = createMockBrowserCard({ answer: "Old A" });
		store.set(snapshot.id, { ...snapshot, answer: "Stored A" });

		await saveCardContent(deps, snapshot, "New Q", "question");

		expect(deps.updateCardContent).toHaveBeenCalledWith(
			"card-1",
			"New Q",
			"Stored A",
		);
	});

	it("skips the write when nothing changed", async () => {
		const { deps, store, executed } = createDeps();
		const card = createMockBrowserCard();
		store.set(card.id, card);

		expect(await saveCardContent(deps, card, "Q", "question")).toBeNull();
		expect(deps.updateCardContent).not.toHaveBeenCalled();
		expect(executed).toHaveLength(0);
	});

	it("refuses image occlusion cards", async () => {
		const { deps, notify } = createDeps();
		const card = createMockBrowserCard({ cardType: "image-occlusion" });

		expect(await saveCardContent(deps, card, "x", "question")).toBeNull();
		expect(notify.warning).toHaveBeenCalled();
		expect(deps.updateCardContent).not.toHaveBeenCalled();
	});

	it("reports a duplicate question without an undo entry or a failure toast", async () => {
		const { deps, store, executed, notify } = createDeps({
			updateCardContent: vi.fn(() => {
				throw new DuplicateQuestionError("other", "uid-2");
			}),
		});
		const card = createMockBrowserCard();
		store.set(card.id, card);

		expect(await saveCardContent(deps, card, "Dup", "question")).toBeNull();
		expect(notify.duplicateQuestion).toHaveBeenCalled();
		expect(notify.operationFailed).not.toHaveBeenCalled();
		expect(executed).toHaveLength(0);
	});

	it("reports other write errors as a failed save", async () => {
		const failure = new Error("disk full");
		const { deps, store, executed, notify } = createDeps({
			updateCardContent: vi.fn(() => {
				throw failure;
			}),
		});
		const card = createMockBrowserCard();
		store.set(card.id, card);

		expect(await saveCardContent(deps, card, "x", "answer")).toBeNull();
		expect(notify.operationFailed).toHaveBeenCalledWith("save card", failure);
		expect(executed).toHaveLength(0);
	});
});

describe("removeOrphanedCards", () => {
	it("does nothing without orphaned cards", async () => {
		const { deps } = createDeps();
		expect(await removeOrphanedCards(deps)).toEqual([]);
		expect(deps.confirm).not.toHaveBeenCalled();
	});

	it("does nothing when the dialog is cancelled", async () => {
		const { deps, executed } = createDeps({
			getOrphanedCardIds: () => ["a"],
			confirm: vi.fn(async () => false),
		});

		expect(await removeOrphanedCards(deps)).toEqual([]);
		expect(executed).toHaveLength(0);
	});

	it("deletes as one command and returns the removed ids", async () => {
		const { deps, store, executed, notify } = createDeps({
			getOrphanedCardIds: () => ["a", "b"],
		});
		store.set("a", createMockBrowserCard({ id: "a" }));
		store.set("b", createMockBrowserCard({ id: "b" }));

		const removed = await removeOrphanedCards(deps);

		expect(deps.confirm).toHaveBeenCalledWith("Remove 2 orphaned cards?");
		expect(executed).toHaveLength(1);
		expect(executed[0]).toBeInstanceOf(DeleteCardCommand);
		expect(removed).toEqual(["a", "b"]);
		expect(notify.cardsDeletedWithUndo).toHaveBeenCalledWith(
			2,
			expect.any(Function),
		);
	});

	it("does not announce a deletion that removed nothing", async () => {
		const { deps, notify } = createDeps({ getOrphanedCardIds: () => ["gone"] });

		expect(await removeOrphanedCards(deps)).toEqual([]);
		expect(notify.cardsDeletedWithUndo).not.toHaveBeenCalled();
		expect(notify.error).toHaveBeenCalled();
	});
});

describe("moveCard", () => {
	it("moves through an undoable command and announces it", async () => {
		const { deps, store, executed, notify } = createDeps();
		const card = createMockBrowserCard();
		store.set(card.id, card);

		expect(await moveCard(deps, card)).toBe(true);
		expect(deps.pickMoveTarget).toHaveBeenCalledWith({
			cardCount: 1,
			sourceNoteName: "Biology",
			cardQuestion: "Q",
			cardAnswer: "A",
		});
		expect(executed[0]).toBeInstanceOf(MoveCardCommand);
		expect(notify.cardsMoved).toHaveBeenCalledWith(1, "Target.md");
	});

	it("does nothing when the dialog is cancelled", async () => {
		const { deps, executed } = createDeps({
			pickMoveTarget: vi.fn(async () => null),
		});

		expect(await moveCard(deps, createMockBrowserCard())).toBe(false);
		expect(executed).toHaveLength(0);
	});

	it("does not announce a move of a card that no longer exists", async () => {
		const { deps, notify } = createDeps();

		expect(await moveCard(deps, createMockBrowserCard())).toBe(false);
		expect(notify.cardsMoved).not.toHaveBeenCalled();
		expect(notify.error).toHaveBeenCalled();
	});

	it("reports a failed move", async () => {
		const failure = new Error("frontmatter write failed");
		const { deps, notify } = createDeps({
			executeCommand: vi.fn(async () => {
				throw failure;
			}),
		});

		expect(await moveCard(deps, createMockBrowserCard())).toBe(false);
		expect(notify.operationFailed).toHaveBeenCalledWith("move card", failure);
		expect(notify.cardsMoved).not.toHaveBeenCalled();
	});
});

describe("moveCards", () => {
	it("moves the selection as one undo step and counts real moves", async () => {
		const { deps, store, executed, notify, moveCardImpl } = createDeps();
		store.set("a", createMockBrowserCard({ id: "a" }));
		store.set("c", createMockBrowserCard({ id: "c" }));

		expect(await moveCards(deps, ["a", "b", "c"])).toBe(true);
		expect(executed).toHaveLength(1);
		expect(executed[0]).toBeInstanceOf(MoveCardsCommand);
		expect(moveCardImpl).toHaveBeenCalledTimes(3);
		expect(notify.cardsMoved).toHaveBeenCalledWith(2, "Target.md");
	});

	it("does nothing for an empty selection or a cancelled dialog", async () => {
		const empty = createDeps();
		expect(await moveCards(empty.deps, [])).toBe(false);
		expect(empty.deps.pickMoveTarget).not.toHaveBeenCalled();

		const cancelled = createDeps({ pickMoveTarget: vi.fn(async () => null) });
		expect(await moveCards(cancelled.deps, ["a"])).toBe(false);
		expect(cancelled.executed).toHaveLength(0);
	});

	it("does not announce a move when nothing moved", async () => {
		const { deps, notify } = createDeps();

		expect(await moveCards(deps, ["missing"])).toBe(false);
		expect(notify.cardsMoved).not.toHaveBeenCalled();
	});
});

describe("editCard", () => {
	it("returns the stored card after the editor closes", async () => {
		const { deps, store } = createDeps({
			openEditor: vi.fn(async () => {
				store.set("card-1", createMockBrowserCard({ question: "Saved" }));
			}),
		});
		store.set("card-1", createMockBrowserCard());

		const next = await editCard(deps, createMockBrowserCard());

		expect(deps.openEditor).toHaveBeenCalledWith(
			"card-1",
			{ id: "note-1" },
			{ id: "basic" },
		);
		expect(next?.question).toBe("Saved");
	});

	it("returns null when the card was deleted while editing", async () => {
		const { deps } = createDeps();
		expect(await editCard(deps, createMockBrowserCard())).toBeNull();
	});

	it("keeps the card and reports when the note cannot be resolved", async () => {
		const { deps, notify } = createDeps({
			resolveEditTarget: vi.fn(() => ({
				ok: false as const,
				error: "Note not found",
			})),
		});
		const card = createMockBrowserCard();

		expect(await editCard(deps, card)).toBe(card);
		expect(notify.error).toHaveBeenCalledWith("Note not found");
		expect(deps.openEditor).not.toHaveBeenCalled();
	});
});

describe("reconcilePreviewCard", () => {
	it("closes the preview when the card is gone", () => {
		expect(reconcilePreviewCard(createMockBrowserCard(), null)).toBeNull();
	});

	it("keeps the same object when nothing changed", () => {
		const shown = createMockBrowserCard({ projects: ["Med"] });
		const stored = createMockBrowserCard({ projects: ["Med"] });
		expect(reconcilePreviewCard(shown, stored)).toBe(shown);
	});

	it("shows the stored card after an undo or a bulk change", () => {
		const shown = createMockBrowserCard({ question: "Edited" });
		const stored = createMockBrowserCard({ question: "Q", suspended: true });

		const next = reconcilePreviewCard(shown, stored);

		expect(next).toBe(stored);
		expect(next?.question).toBe("Q");
		expect(next?.suspended).toBe(true);
	});
});
