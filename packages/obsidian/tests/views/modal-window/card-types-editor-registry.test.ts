import { describe, expect, it, vi } from "vitest";

import {
	type CardTypesEditorRequestId,
	consumeCardTypesEditorRequest,
	drainCardTypesEditorRequests,
	newCardTypesEditorRequestId,
	registerCardTypesEditorRequest,
} from "@true-recall/obsidian/views/modal-window/card-types-editor-registry";

describe("card-types-editor-registry", () => {
	describe("newCardTypesEditorRequestId", () => {
		it("returns a prefixed id", () => {
			const id = newCardTypesEditorRequestId();
			expect(id).toMatch(/^cte-/);
		});

		it("returns unique ids across calls", () => {
			const ids = new Set<string>();
			for (let i = 0; i < 50; i++) {
				ids.add(newCardTypesEditorRequestId());
			}
			expect(ids.size).toBe(50);
		});
	});

	describe("register/consume roundtrip", () => {
		it("returns the registered entry on consume", () => {
			const id = newCardTypesEditorRequestId();
			const onClose = vi.fn();
			registerCardTypesEditorRequest(id, "note-type-a", onClose);

			const entry = consumeCardTypesEditorRequest(id);
			expect(entry).toBeDefined();
			expect(entry?.noteTypeId).toBe("note-type-a");
			expect(entry?.onClose).toBe(onClose);
		});

		it("does not fire onClose on a normal consume", () => {
			const id = newCardTypesEditorRequestId();
			const onClose = vi.fn();
			registerCardTypesEditorRequest(id, "note-type-a", onClose);

			consumeCardTypesEditorRequest(id);
			expect(onClose).not.toHaveBeenCalled();
		});

		it("removes the entry after consume (single-shot)", () => {
			const id = newCardTypesEditorRequestId();
			registerCardTypesEditorRequest(id, "nt", vi.fn());

			expect(consumeCardTypesEditorRequest(id)).toBeDefined();
			expect(consumeCardTypesEditorRequest(id)).toBeUndefined();
		});

		it("returns undefined for an unknown id", () => {
			const unknown = "cte-not-registered" as CardTypesEditorRequestId;
			expect(consumeCardTypesEditorRequest(unknown)).toBeUndefined();
		});

		it("isolates entries by id", () => {
			const idA = newCardTypesEditorRequestId();
			const idB = newCardTypesEditorRequestId();
			const onCloseA = vi.fn();
			const onCloseB = vi.fn();

			registerCardTypesEditorRequest(idA, "nt-a", onCloseA);
			registerCardTypesEditorRequest(idB, "nt-b", onCloseB);

			expect(consumeCardTypesEditorRequest(idA)?.onClose).toBe(onCloseA);
			expect(consumeCardTypesEditorRequest(idB)?.onClose).toBe(onCloseB);
		});

		it("handles entries with no onClose callback", () => {
			const id = newCardTypesEditorRequestId();
			registerCardTypesEditorRequest(id, "nt");
			const entry = consumeCardTypesEditorRequest(id);
			expect(entry?.onClose).toBeUndefined();
		});
	});

	describe("duplicate registration", () => {
		it("fires the displaced entry's onClose exactly once on overwrite", () => {
			const id = newCardTypesEditorRequestId();
			const firstOnClose = vi.fn();
			const secondOnClose = vi.fn();

			registerCardTypesEditorRequest(id, "nt-a", firstOnClose);
			registerCardTypesEditorRequest(id, "nt-b", secondOnClose);

			expect(firstOnClose).toHaveBeenCalledTimes(1);
			expect(secondOnClose).not.toHaveBeenCalled();
		});

		it("keeps the second registration consumable after overwrite", () => {
			const id = newCardTypesEditorRequestId();
			const secondOnClose = vi.fn();

			registerCardTypesEditorRequest(id, "nt-a", vi.fn());
			registerCardTypesEditorRequest(id, "nt-b", secondOnClose);

			const entry = consumeCardTypesEditorRequest(id);
			expect(entry?.noteTypeId).toBe("nt-b");
			expect(entry?.onClose).toBe(secondOnClose);
		});
	});

	describe("drainCardTypesEditorRequests", () => {
		it("fires onClose for every pending entry and clears the registry", () => {
			const idA = newCardTypesEditorRequestId();
			const idB = newCardTypesEditorRequestId();
			const onCloseA = vi.fn();
			const onCloseB = vi.fn();

			registerCardTypesEditorRequest(idA, "nt-a", onCloseA);
			registerCardTypesEditorRequest(idB, "nt-b", onCloseB);

			drainCardTypesEditorRequests();

			expect(onCloseA).toHaveBeenCalledTimes(1);
			expect(onCloseB).toHaveBeenCalledTimes(1);
			expect(consumeCardTypesEditorRequest(idA)).toBeUndefined();
			expect(consumeCardTypesEditorRequest(idB)).toBeUndefined();
		});

		it("does not throw when an onClose callback throws", () => {
			const id = newCardTypesEditorRequestId();
			registerCardTypesEditorRequest(id, "nt", () => {
				throw new Error("boom");
			});

			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			expect(() => drainCardTypesEditorRequests()).not.toThrow();
			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();
		});

		it("is a no-op when nothing is pending", () => {
			drainCardTypesEditorRequests();
			expect(() => drainCardTypesEditorRequests()).not.toThrow();
		});
	});
});
