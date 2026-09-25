import { describe, expect, it, vi } from "vitest";

import {
	EditorRequestSession,
	type PendingEditorRequest,
} from "@true-recall/obsidian/views/modal-window/editor-request-session";

type Result = { cancelled: boolean; value?: string };

function createSession(
	entries: Record<string, PendingEditorRequest<string, Result>> = {},
) {
	const registry = new Map(Object.entries(entries));
	const consume = vi.fn((id: string) => {
		const entry = registry.get(id);
		registry.delete(id);
		return entry;
	});
	const session = new EditorRequestSession<string, string, Result>({
		consume,
		cancelledResult: () => ({ cancelled: true }),
	});
	return { session, consume, registry };
}

function pending(mode = "add") {
	return { mode, resolve: vi.fn() };
}

describe("EditorRequestSession", () => {
	describe("adopt", () => {
		it("takes a pending request out of the registry", () => {
			const request = pending("edit");
			const { session, registry } = createSession({ a: request });

			expect(session.adopt("a")).toBe(true);
			expect(session.requestId).toBe("a");
			expect(session.mode).toBe("edit");
			expect(session.isActive).toBe(true);
			expect(registry.has("a")).toBe(false);
		});

		it.each([
			["a missing id", undefined],
			["a null id", null],
			["an empty id", ""],
		])("ignores %s", (_label, id) => {
			const { session, consume } = createSession();

			expect(session.adopt(id)).toBe(false);
			expect(consume).not.toHaveBeenCalled();
			expect(session.isActive).toBe(false);
		});

		it("ignores an id that is not registered", () => {
			const { session } = createSession();

			expect(session.adopt("gone")).toBe(false);
			expect(session.isActive).toBe(false);
		});

		it("keeps the current request when the same id arrives again", () => {
			const { session, consume } = createSession({ a: pending() });
			session.adopt("a");

			expect(session.adopt("a")).toBe(false);
			expect(consume).toHaveBeenCalledTimes(1);
			expect(session.requestId).toBe("a");
		});

		it("keeps the current request when a stale id arrives", () => {
			const first = pending();
			const { session } = createSession({ a: first });
			session.adopt("a");

			expect(session.adopt("gone")).toBe(false);
			expect(session.requestId).toBe("a");
			expect(first.resolve).not.toHaveBeenCalled();
		});

		it("cancels an open request it replaces", () => {
			const first = pending();
			const second = pending();
			const { session } = createSession({ a: first, b: second });
			session.adopt("a");

			session.adopt("b");

			expect(first.resolve).toHaveBeenCalledWith({ cancelled: true });
			expect(session.requestId).toBe("b");
			expect(session.isSettled).toBe(false);
		});

		it("does not settle a replaced request twice", () => {
			const first = pending();
			const { session } = createSession({ a: first, b: pending() });
			session.adopt("a");
			session.settle({ cancelled: false });

			session.adopt("b");

			expect(first.resolve).toHaveBeenCalledTimes(1);
		});
	});

	describe("settle", () => {
		it("delivers the result once", () => {
			const request = pending();
			const { session } = createSession({ a: request });
			session.adopt("a");

			expect(session.settle({ cancelled: false, value: "x" })).toBe(true);
			expect(session.settle({ cancelled: false, value: "y" })).toBe(false);
			expect(session.cancel()).toBe(false);

			expect(request.resolve).toHaveBeenCalledTimes(1);
			expect(request.resolve).toHaveBeenCalledWith({
				cancelled: false,
				value: "x",
			});
			expect(session.isSettled).toBe(true);
		});

		it("does nothing without a request", () => {
			const { session } = createSession();

			expect(session.settle({ cancelled: false })).toBe(false);
			expect(session.cancel()).toBe(false);
		});

		it("keeps the request id after settling", () => {
			const { session } = createSession({ a: pending() });
			session.adopt("a");
			session.cancel();

			expect(session.requestId).toBe("a");
			expect(session.isActive).toBe(true);
		});
	});

	describe("cancel", () => {
		it("settles an open request as cancelled", () => {
			const request = pending();
			const { session } = createSession({ a: request });
			session.adopt("a");

			expect(session.cancel()).toBe(true);
			expect(request.resolve).toHaveBeenCalledWith({ cancelled: true });
		});
	});
});
