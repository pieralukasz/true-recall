import { describe, expect, it, vi } from "vitest";

import type { QuickNoteEditorMode } from "@true-recall/obsidian/modals/study/quick-note-editor/types";
import {
	consumeQuickNoteEditorRequest,
	newQuickNoteEditorRequestId,
	type QuickNoteEditorRequestId,
	registerQuickNoteEditorRequest,
} from "@true-recall/obsidian/views/modal-window/quick-note-editor-registry";

const addMode: QuickNoteEditorMode = { mode: "add" };

describe("quick-note-editor-registry", () => {
	describe("newQuickNoteEditorRequestId", () => {
		it("returns a prefixed id", () => {
			const id = newQuickNoteEditorRequestId();
			expect(id).toMatch(/^qne-/);
		});

		it("returns unique ids across calls", () => {
			const ids = new Set<string>();
			for (let i = 0; i < 50; i++) {
				ids.add(newQuickNoteEditorRequestId());
			}
			expect(ids.size).toBe(50);
		});
	});

	describe("register/consume roundtrip", () => {
		it("returns the registered entry on consume", () => {
			const id = newQuickNoteEditorRequestId();
			const resolve = vi.fn();
			registerQuickNoteEditorRequest(id, addMode, resolve);

			const entry = consumeQuickNoteEditorRequest(id);
			expect(entry).toBeDefined();
			expect(entry?.mode).toBe(addMode);
			expect(entry?.resolve).toBe(resolve);
		});

		it("removes the entry after consume (single-shot)", () => {
			const id = newQuickNoteEditorRequestId();
			registerQuickNoteEditorRequest(id, addMode, vi.fn());

			expect(consumeQuickNoteEditorRequest(id)).toBeDefined();
			expect(consumeQuickNoteEditorRequest(id)).toBeUndefined();
		});

		it("returns undefined for an unknown id", () => {
			const unknown = "qne-not-registered" as QuickNoteEditorRequestId;
			expect(consumeQuickNoteEditorRequest(unknown)).toBeUndefined();
		});

		it("isolates entries by id", () => {
			const idA = newQuickNoteEditorRequestId();
			const idB = newQuickNoteEditorRequestId();
			const resolveA = vi.fn();
			const resolveB = vi.fn();

			registerQuickNoteEditorRequest(idA, addMode, resolveA);
			registerQuickNoteEditorRequest(idB, addMode, resolveB);

			expect(consumeQuickNoteEditorRequest(idA)?.resolve).toBe(resolveA);
			expect(consumeQuickNoteEditorRequest(idB)?.resolve).toBe(resolveB);
		});
	});

	describe("duplicate registration", () => {
		it("resolves the previous resolver with cancelled when overwritten", () => {
			const id = newQuickNoteEditorRequestId();
			const firstResolve = vi.fn();
			const secondResolve = vi.fn();

			registerQuickNoteEditorRequest(id, addMode, firstResolve);
			registerQuickNoteEditorRequest(id, addMode, secondResolve);

			expect(firstResolve).toHaveBeenCalledWith({ cancelled: true });
			expect(firstResolve).toHaveBeenCalledTimes(1);
			expect(secondResolve).not.toHaveBeenCalled();
		});

		it("keeps the second registration consumable after overwrite", () => {
			const id = newQuickNoteEditorRequestId();
			const secondResolve = vi.fn();

			registerQuickNoteEditorRequest(id, addMode, vi.fn());
			registerQuickNoteEditorRequest(id, addMode, secondResolve);

			const entry = consumeQuickNoteEditorRequest(id);
			expect(entry?.resolve).toBe(secondResolve);
		});
	});
});
