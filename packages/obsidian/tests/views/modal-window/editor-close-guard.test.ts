import { describe, expect, it, vi } from "vitest";

import { EditorCloseGuard } from "@true-recall/obsidian/views/modal-window/editor-close-guard";

import { createFakeWindow } from "./fake-popout";

interface Deferred {
	signal: AbortSignal;
	answer(value: boolean): void;
}

function createGuard() {
	const dialogs: Deferred[] = [];
	const confirm = vi.fn(
		(signal: AbortSignal) =>
			new Promise<boolean>((resolve) => {
				let done = false;
				const answer = (value: boolean) => {
					if (done) return;
					done = true;
					resolve(value);
				};
				signal.addEventListener("abort", () => answer(false));
				dialogs.push({ signal, answer });
			}),
	);
	const guard = new EditorCloseGuard(confirm);
	return { guard, confirm, dialogs };
}

async function settle(): Promise<void> {
	for (let i = 0; i < 3; i++) await Promise.resolve();
}

function unloadEvent() {
	return { preventDefault: vi.fn() };
}

describe("EditorCloseGuard", () => {
	describe("requestClose", () => {
		it("closes a clean editor synchronously", () => {
			const { guard, confirm } = createGuard();
			const close = vi.fn();

			guard.requestClose(close);

			expect(close).toHaveBeenCalledTimes(1);
			expect(confirm).not.toHaveBeenCalled();
		});

		it("closes after a confirmed discard", async () => {
			const { guard, dialogs } = createGuard();
			const close = vi.fn();
			guard.setDirty(true);

			guard.requestClose(close);
			expect(close).not.toHaveBeenCalled();
			expect(guard.isConfirming).toBe(true);
			dialogs[0]?.answer(true);
			await settle();

			expect(close).toHaveBeenCalledTimes(1);
			expect(guard.isConfirming).toBe(false);
			expect(guard.hasUnsavedChanges).toBe(false);
		});

		it("keeps the editor when the discard is cancelled", async () => {
			const { guard, dialogs } = createGuard();
			const close = vi.fn();
			guard.setDirty(true);

			guard.requestClose(close);
			dialogs[0]?.answer(false);
			await settle();

			expect(close).not.toHaveBeenCalled();
			expect(guard.hasUnsavedChanges).toBe(true);
			expect(guard.isConfirming).toBe(false);
		});

		it("opens one dialog for concurrent requests", async () => {
			const { guard, confirm, dialogs } = createGuard();
			const first = vi.fn();
			const second = vi.fn();
			guard.setDirty(true);

			guard.requestClose(first);
			guard.requestClose(second);
			dialogs[0]?.answer(true);
			await settle();

			expect(confirm).toHaveBeenCalledTimes(1);
			expect(first).toHaveBeenCalledTimes(1);
			expect(second).not.toHaveBeenCalled();
		});

		it("closes without asking again once discarded", async () => {
			const { guard, confirm, dialogs } = createGuard();
			guard.setDirty(true);
			guard.requestClose(vi.fn());
			dialogs[0]?.answer(true);
			await settle();
			const close = vi.fn();

			guard.requestClose(close);

			expect(close).toHaveBeenCalledTimes(1);
			expect(confirm).toHaveBeenCalledTimes(1);
		});

		it("closes a formerly dirty editor that became clean", () => {
			const { guard, confirm } = createGuard();
			const close = vi.fn();
			guard.setDirty(true);
			guard.setDirty(false);

			guard.requestClose(close);

			expect(close).toHaveBeenCalledTimes(1);
			expect(confirm).not.toHaveBeenCalled();
		});
	});

	describe("reset and dispose", () => {
		it.each([
			["reset", (guard: EditorCloseGuard) => guard.reset()],
			["dispose", (guard: EditorCloseGuard) => guard.dispose()],
		])("%s dismisses an open dialog without closing", async (_label, end) => {
			const { guard, dialogs } = createGuard();
			const close = vi.fn();
			guard.setDirty(true);
			guard.requestClose(close);

			end(guard);
			await settle();

			expect(dialogs[0]?.signal.aborted).toBe(true);
			expect(close).not.toHaveBeenCalled();
			expect(guard.isConfirming).toBe(false);
		});

		it("ignores a confirmation that arrives after the dialog was dismissed", async () => {
			let answer: (value: boolean) => void = () => {};
			const guard = new EditorCloseGuard(
				() =>
					new Promise<boolean>((resolve) => {
						answer = resolve;
					}),
			);
			const close = vi.fn();
			guard.setDirty(true);
			guard.requestClose(close);

			guard.dispose();
			answer(true);
			await settle();

			expect(close).not.toHaveBeenCalled();
		});

		it("lets the next session ask after a reset", async () => {
			const { guard, confirm } = createGuard();
			guard.setDirty(true);
			guard.requestClose(vi.fn());
			guard.reset();
			await settle();
			guard.setDirty(true);

			guard.requestClose(vi.fn());

			expect(confirm).toHaveBeenCalledTimes(2);
		});

		it("forgets a confirmed discard on reset", async () => {
			const { guard, dialogs } = createGuard();
			guard.setDirty(true);
			guard.requestClose(vi.fn());
			dialogs[0]?.answer(true);
			await settle();

			guard.reset();
			guard.setDirty(true);

			expect(guard.hasUnsavedChanges).toBe(true);
		});
	});

	describe("bindWindow", () => {
		it("blocks unloading with unsaved changes", () => {
			const fw = createFakeWindow();
			const { guard } = createGuard();
			guard.bindWindow(fw.win);
			guard.setDirty(true);

			const event = unloadEvent();
			fw.dispatch("beforeunload", event);

			expect(event.preventDefault).toHaveBeenCalledTimes(1);
		});

		it("allows unloading a clean editor", () => {
			const fw = createFakeWindow();
			const { guard } = createGuard();
			guard.bindWindow(fw.win);

			const event = unloadEvent();
			fw.dispatch("beforeunload", event);

			expect(event.preventDefault).not.toHaveBeenCalled();
		});

		it("allows unloading after a confirmed discard", async () => {
			const fw = createFakeWindow();
			const { guard, dialogs } = createGuard();
			guard.bindWindow(fw.win);
			guard.setDirty(true);
			guard.requestClose(vi.fn());
			dialogs[0]?.answer(true);
			await settle();

			const event = unloadEvent();
			fw.dispatch("beforeunload", event);

			expect(event.preventDefault).not.toHaveBeenCalled();
		});

		it("moves the listener to a new window", () => {
			const first = createFakeWindow();
			const second = createFakeWindow();
			const { guard } = createGuard();

			guard.bindWindow(first.win);
			guard.bindWindow(second.win);

			expect(first.listenerCount("beforeunload")).toBe(0);
			expect(second.listenerCount("beforeunload")).toBe(1);
		});

		it.each([
			["binding null", (guard: EditorCloseGuard) => guard.bindWindow(null)],
			["dispose", (guard: EditorCloseGuard) => guard.dispose()],
		])("%s removes the listener", (_label, release) => {
			const fw = createFakeWindow();
			const { guard } = createGuard();
			guard.bindWindow(fw.win);

			release(guard);

			expect(fw.listenerCount("beforeunload")).toBe(0);
		});
	});
});
