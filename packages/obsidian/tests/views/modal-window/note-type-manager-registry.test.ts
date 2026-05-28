import { describe, expect, it, vi } from "vitest";

import {
	consumeNoteTypeManagerRequest,
	drainNoteTypeManagerRequests,
	type NoteTypeManagerRequestId,
	newNoteTypeManagerRequestId,
	registerNoteTypeManagerRequest,
} from "@true-recall/obsidian/views/modal-window/note-type-manager-registry";

describe("note-type-manager-registry", () => {
	describe("newNoteTypeManagerRequestId", () => {
		it("returns a prefixed id", () => {
			const id = newNoteTypeManagerRequestId();
			expect(id).toMatch(/^ntm-/);
		});

		it("returns unique ids across calls", () => {
			const ids = new Set<string>();
			for (let i = 0; i < 50; i++) {
				ids.add(newNoteTypeManagerRequestId());
			}
			expect(ids.size).toBe(50);
		});
	});

	describe("register/consume roundtrip", () => {
		it("returns the registered entry on consume", () => {
			const id = newNoteTypeManagerRequestId();
			const onClose = vi.fn();
			registerNoteTypeManagerRequest(id, onClose);

			const entry = consumeNoteTypeManagerRequest(id);
			expect(entry).toBeDefined();
			expect(entry?.onClose).toBe(onClose);
		});

		it("does not fire onClose on a normal consume", () => {
			const id = newNoteTypeManagerRequestId();
			const onClose = vi.fn();
			registerNoteTypeManagerRequest(id, onClose);

			consumeNoteTypeManagerRequest(id);
			expect(onClose).not.toHaveBeenCalled();
		});

		it("removes the entry after consume (single-shot)", () => {
			const id = newNoteTypeManagerRequestId();
			registerNoteTypeManagerRequest(id, vi.fn());

			expect(consumeNoteTypeManagerRequest(id)).toBeDefined();
			expect(consumeNoteTypeManagerRequest(id)).toBeUndefined();
		});

		it("returns undefined for an unknown id", () => {
			const unknown = "ntm-not-registered" as NoteTypeManagerRequestId;
			expect(consumeNoteTypeManagerRequest(unknown)).toBeUndefined();
		});

		it("isolates entries by id", () => {
			const idA = newNoteTypeManagerRequestId();
			const idB = newNoteTypeManagerRequestId();
			const onCloseA = vi.fn();
			const onCloseB = vi.fn();

			registerNoteTypeManagerRequest(idA, onCloseA);
			registerNoteTypeManagerRequest(idB, onCloseB);

			expect(consumeNoteTypeManagerRequest(idA)?.onClose).toBe(onCloseA);
			expect(consumeNoteTypeManagerRequest(idB)?.onClose).toBe(onCloseB);
		});

		it("handles entries with no onClose callback", () => {
			const id = newNoteTypeManagerRequestId();
			registerNoteTypeManagerRequest(id);
			const entry = consumeNoteTypeManagerRequest(id);
			expect(entry?.onClose).toBeUndefined();
		});
	});

	describe("duplicate registration", () => {
		it("fires the displaced entry's onClose exactly once on overwrite", () => {
			const id = newNoteTypeManagerRequestId();
			const firstOnClose = vi.fn();
			const secondOnClose = vi.fn();

			registerNoteTypeManagerRequest(id, firstOnClose);
			registerNoteTypeManagerRequest(id, secondOnClose);

			expect(firstOnClose).toHaveBeenCalledTimes(1);
			expect(secondOnClose).not.toHaveBeenCalled();
		});

		it("keeps the second registration consumable after overwrite", () => {
			const id = newNoteTypeManagerRequestId();
			const secondOnClose = vi.fn();

			registerNoteTypeManagerRequest(id, vi.fn());
			registerNoteTypeManagerRequest(id, secondOnClose);

			const entry = consumeNoteTypeManagerRequest(id);
			expect(entry?.onClose).toBe(secondOnClose);
		});
	});

	describe("drainNoteTypeManagerRequests", () => {
		it("fires onClose for every pending entry and clears the registry", () => {
			const idA = newNoteTypeManagerRequestId();
			const idB = newNoteTypeManagerRequestId();
			const onCloseA = vi.fn();
			const onCloseB = vi.fn();

			registerNoteTypeManagerRequest(idA, onCloseA);
			registerNoteTypeManagerRequest(idB, onCloseB);

			drainNoteTypeManagerRequests();

			expect(onCloseA).toHaveBeenCalledTimes(1);
			expect(onCloseB).toHaveBeenCalledTimes(1);
			expect(consumeNoteTypeManagerRequest(idA)).toBeUndefined();
			expect(consumeNoteTypeManagerRequest(idB)).toBeUndefined();
		});

		it("does not throw when an onClose callback throws", () => {
			const id = newNoteTypeManagerRequestId();
			registerNoteTypeManagerRequest(id, () => {
				throw new Error("boom");
			});

			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(() => drainNoteTypeManagerRequests()).not.toThrow();
			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();
		});

		it("is a no-op when nothing is pending", () => {
			drainNoteTypeManagerRequests();
			expect(() => drainNoteTypeManagerRequests()).not.toThrow();
		});
	});
});
