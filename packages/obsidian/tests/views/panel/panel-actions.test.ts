import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import { PanelActions } from "@true-recall/obsidian/views/panel/PanelActions";

import { createTestStore } from "../../store/test-helpers";
import { createMockFile, createMockFlashcardInfo } from "./panel-test-harness";

const notifications = vi.hoisted(() => ({
	success: vi.fn(),
	warning: vi.fn(),
	cardsDeletedWithUndo: vi.fn(),
}));

vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => notifications,
}));

function createActions() {
	const store = createTestStore();
	const commandService = {
		execute: vi.fn(async (cmd: DeleteCardCommand) => {
			cmd.deletedCount = 2;
		}),
		undo: vi.fn().mockResolvedValue(true),
	};
	const deps = {
		openNote: vi.fn().mockResolvedValue(undefined),
		getPanel: () => store.getState().panel,
		getCommandService: () => commandService,
		cardsToText: vi.fn((cards: Array<{ question: string }>) =>
			cards.map((card) => card.question).join("|"),
		),
		confirm: vi.fn().mockResolvedValue(true),
		writeClipboard: vi.fn().mockResolvedValue(undefined),
		downloadFile: vi.fn(),
	};
	const actions = new PanelActions(deps as never);
	const showNote = (withCards: boolean) => {
		store.getState().panel.setCurrentFile(createMockFile("notes/Bio.md"));
		store.getState().panel.setFlashcardInfo(
			createMockFlashcardInfo(
				withCards
					? [
							{ id: "c1", question: "a,b", answer: 'x "y"' },
							{ id: "c2", question: "Q2", answer: "line\nbreak" },
						]
					: [],
			),
		);
	};
	return { actions, deps, commandService, showNote };
}

beforeEach(() => {
	for (const fn of Object.values(notifications)) fn.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("PanelActions.deleteAllFlashcards", () => {
	it("deletes every card of the note and offers undo", async () => {
		const f = createActions();
		f.showNote(true);

		await f.actions.deleteAllFlashcards();

		expect(f.deps.confirm).toHaveBeenCalledWith(
			"Delete all 2 flashcard(s) for this note?",
		);
		const cmd = f.commandService.execute.mock.calls[0]?.[0];
		expect(cmd).toBeInstanceOf(DeleteCardCommand);
		expect(notifications.cardsDeletedWithUndo).toHaveBeenCalledWith(
			2,
			expect.any(Function),
		);

		const onUndo = notifications.cardsDeletedWithUndo.mock.calls[0]?.[1];
		onUndo();
		expect(f.commandService.undo).toHaveBeenCalledOnce();
	});

	it("does nothing when the user cancels", async () => {
		const f = createActions();
		f.showNote(true);
		f.deps.confirm.mockResolvedValue(false);

		await f.actions.deleteAllFlashcards();

		expect(f.commandService.execute).not.toHaveBeenCalled();
		expect(notifications.cardsDeletedWithUndo).not.toHaveBeenCalled();
	});

	it("does not ask for confirmation without cards", async () => {
		const f = createActions();
		f.showNote(false);

		await f.actions.deleteAllFlashcards();

		expect(f.deps.confirm).not.toHaveBeenCalled();
	});
});

describe("PanelActions.copyAllToClipboard", () => {
	it("copies the block text of all cards", async () => {
		const f = createActions();
		f.showNote(true);

		await f.actions.copyAllToClipboard();

		expect(f.deps.writeClipboard).toHaveBeenCalledWith("a,b|Q2");
		expect(notifications.success).toHaveBeenCalledWith(
			"Copied 2 flashcard(s) to clipboard",
		);
	});

	it("warns without cards", async () => {
		const f = createActions();
		f.showNote(false);

		await f.actions.copyAllToClipboard();

		expect(f.deps.writeClipboard).not.toHaveBeenCalled();
		expect(notifications.warning).toHaveBeenCalledWith("No flashcards to copy");
	});
});

describe("PanelActions.exportCsv", () => {
	it("downloads an escaped CSV named after the note", () => {
		const f = createActions();
		f.showNote(true);

		f.actions.exportCsv();

		expect(f.deps.downloadFile).toHaveBeenCalledWith(
			'Question,Answer\n"a,b","x ""y"""\nQ2,"line\nbreak"',
			"Bio-flashcards.csv",
			"text/csv;charset=utf-8;",
		);
		expect(notifications.success).toHaveBeenCalledWith(
			"Exported 2 flashcard(s) to CSV",
		);
	});

	it("warns without cards", () => {
		const f = createActions();
		f.showNote(false);

		f.actions.exportCsv();

		expect(f.deps.downloadFile).not.toHaveBeenCalled();
		expect(notifications.warning).toHaveBeenCalledWith(
			"No flashcards to export",
		);
	});
});

describe("PanelActions.openFlashcardFile", () => {
	it("opens the current note", async () => {
		const f = createActions();
		f.showNote(true);

		await f.actions.openFlashcardFile();

		expect(f.deps.openNote).toHaveBeenCalledWith("notes/Bio.md");
	});
});
