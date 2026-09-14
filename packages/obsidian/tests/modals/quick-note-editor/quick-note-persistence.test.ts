import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createQuickNoteState,
	type QuickNoteAction,
	quickNoteReducer,
} from "../../../src/modals/study/quick-note-editor/domain/quick-note-state";
import type { QuickNoteEditor } from "../../../src/modals/study/quick-note-editor/hooks/useQuickNoteEditor";
import { useQuickNotePersistence } from "../../../src/modals/study/quick-note-editor/hooks/useQuickNotePersistence";

vi.mock("preact/hooks", () => ({
	useCallback: (callback: unknown) => callback,
	useRef: (value: unknown) => ({ current: value }),
	useState: (value: unknown) => [value, vi.fn()],
}));
vi.mock("../../../src/services/notification.service", () => ({
	notify: () => ({ cardsCreated: vi.fn(), operationFailed: vi.fn() }),
}));

function createEditorFixture() {
	const stateRef = {
		current: createQuickNoteState(
			{ mode: "add", initialFields: { Front: "Question", Back: "Answer" } },
			["Front", "Back"],
		),
	};
	const revisionRef = { current: 0 };
	const dispatch = (action: QuickNoteAction) => {
		stateRef.current = quickNoteReducer(stateRef.current, action);
	};
	const createNote = vi.fn(() => ({ cards: [{ id: "card-1" }] }));
	const commandService = {
		execute: vi.fn().mockResolvedValue(undefined),
		isNextUndo: vi.fn(() => true),
		undo: vi.fn().mockResolvedValue(true),
	};
	const resolveSourceUid = vi.fn().mockResolvedValue("source-1");
	const onDone = vi.fn();
	const editor = {
		stateRef,
		revisionRef,
		dispatch,
		isEdit: false,
		editMode: null,
		noteType: { id: "builtin-basic", fields: ["Front", "Back"] },
		sourceNoteFile: null,
		showSourcePicker: false,
		selectedSourceNote: null,
		resolveSourceUid,
		plugin: {
			commandService,
			flashcardManager: { hasStore: () => true, createNote },
		},
	} as unknown as QuickNoteEditor;
	const persistence = useQuickNotePersistence(editor, onDone);
	const userEdit = (action: QuickNoteAction) => {
		revisionRef.current += 1;
		dispatch(action);
	};
	return {
		editor,
		persistence,
		createNote,
		commandService,
		resolveSourceUid,
		stateRef,
		dispatch,
		userEdit,
		onDone,
	};
}

describe("Quick Note persistence and creation undo", () => {
	beforeEach(() => vi.clearAllMocks());

	it("saves a live editor commit made immediately before the shortcut", async () => {
		const f = createEditorFixture();
		f.userEdit({ type: "field", name: "Front", value: "Live text" });
		await expect(f.persistence.handleSave()).resolves.toBe(true);
		expect(f.createNote).toHaveBeenCalledWith(
			expect.objectContaining({
				fields: { Front: "Live text", Back: "Answer" },
				sourceUid: "source-1",
			}),
		);
		expect(f.stateRef.current.fields).toEqual({ Front: "", Back: "" });
		expect(f.onDone).not.toHaveBeenCalled();
	});

	it("prevents a duplicate save while resolving the source", async () => {
		const f = createEditorFixture();
		const source = Promise.withResolvers<string>();
		f.resolveSourceUid.mockReturnValue(source.promise);
		const first = f.persistence.handleSave();
		await expect(f.persistence.handleSave()).resolves.toBe(false);
		source.resolve("source-1");
		await first;
		expect(f.createNote).toHaveBeenCalledOnce();
	});

	it("keeps the mobile editor open after a failed save and allows retry", async () => {
		const f = createEditorFixture();
		f.resolveSourceUid.mockRejectedValueOnce(new Error("Failed to write UID"));
		await f.persistence.handleSaveAndClose();
		expect(f.onDone).not.toHaveBeenCalled();
		expect(f.stateRef.current.fields.Front).toBe("Question");
		await f.persistence.handleSaveAndClose();
		expect(f.onDone).toHaveBeenCalledWith({ cancelled: false });
		expect(f.createNote).toHaveBeenCalledOnce();
	});

	it("requires the source picker selection for keyboard saves too", async () => {
		const f = createEditorFixture();
		const persistence = useQuickNotePersistence(
			{ ...f.editor, showSourcePicker: true },
			f.onDone,
		);
		await expect(persistence.handleSave()).resolves.toBe(false);
		expect(f.createNote).not.toHaveBeenCalled();
	});

	it("preserves pins after save and restores both fields and comment on undo", async () => {
		const f = createEditorFixture();
		f.dispatch({ type: "pin", name: "Back" });
		f.userEdit({ type: "comment", value: "My comment" });
		await f.persistence.handleSave();
		expect(f.stateRef.current.fields).toEqual({ Front: "", Back: "Answer" });
		expect(f.stateRef.current.userComment).toBe("");
		expect(f.persistence.handleUndoLastCreate()).toBe(true);
		await Promise.resolve();
		expect(f.stateRef.current.fields).toEqual({
			Front: "Question",
			Back: "Answer",
		});
		expect(f.stateRef.current.userComment).toBe("My comment");
	});

	it.each([
		"edited",
		"stack changed",
	])("does not intercept ordinary undo after %s", async (reason) => {
		const f = createEditorFixture();
		await f.persistence.handleSave();
		if (reason === "edited")
			f.userEdit({ type: "field", name: "Front", value: "Another draft" });
		else f.commandService.isNextUndo.mockReturnValue(false);
		expect(f.persistence.handleUndoLastCreate()).toBe(false);
		expect(f.commandService.undo).not.toHaveBeenCalled();
	});

	it("retains a newer draft and stays open when a pending mobile save completes", async () => {
		const f = createEditorFixture();
		const source = Promise.withResolvers<string>();
		f.resolveSourceUid.mockReturnValue(source.promise);
		const saving = f.persistence.handleSaveAndClose();
		f.userEdit({ type: "field", name: "Front", value: "Next draft" });
		source.resolve("source-1");
		await saving;
		expect(f.createNote).toHaveBeenCalledWith(
			expect.objectContaining({
				fields: { Front: "Question", Back: "Answer" },
			}),
		);
		expect(f.stateRef.current.fields.Front).toBe("Next draft");
		expect(f.onDone).not.toHaveBeenCalled();
		expect(f.persistence.handleUndoLastCreate()).toBe(false);
	});

	it("does not overwrite typing that happens while creation undo is pending", async () => {
		const f = createEditorFixture();
		await f.persistence.handleSave();
		const undo = Promise.withResolvers<boolean>();
		f.commandService.undo.mockReturnValue(undo.promise);
		expect(f.persistence.handleUndoLastCreate()).toBe(true);
		f.userEdit({ type: "field", name: "Front", value: "Newer input" });
		undo.resolve(true);
		await undo.promise;
		expect(f.stateRef.current.fields.Front).toBe("Newer input");
	});
});
