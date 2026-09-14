import { describe, expect, it, vi } from "vitest";

import { deferSettingsWork } from "../../src/settings/defer-settings-work";

describe("deferSettingsWork", () => {
	it("waits for a paint and an idle period before running work", () => {
		const work = vi.fn();
		const scheduler = createScheduler();

		deferSettingsWork(work, scheduler.value);

		expect(work).not.toHaveBeenCalled();
		scheduler.runAnimationFrame();
		expect(work).not.toHaveBeenCalled();
		scheduler.runIdleCallback();
		expect(work).toHaveBeenCalledOnce();
	});

	it("cancels pending work when the settings section unmounts", () => {
		const work = vi.fn();
		const scheduler = createScheduler();
		const cancel = deferSettingsWork(work, scheduler.value);

		scheduler.runAnimationFrame();
		cancel();
		scheduler.runIdleCallback();

		expect(work).not.toHaveBeenCalled();
		expect(scheduler.value.cancelAnimationFrame).toHaveBeenCalledWith(11);
		expect(scheduler.value.cancelIdleCallback).toHaveBeenCalledWith(22);
	});

	it("falls back to a timer when requestIdleCallback is unavailable", () => {
		const work = vi.fn();
		const scheduler = createScheduler({ idle: false });

		deferSettingsWork(work, scheduler.value);
		scheduler.runAnimationFrame();
		scheduler.runTimeout();

		expect(work).toHaveBeenCalledOnce();
	});
});

function createScheduler({ idle = true } = {}) {
	let animationFrame: FrameRequestCallback | undefined;
	let idleCallback: IdleRequestCallback | undefined;
	let timeoutCallback: (() => void) | undefined;
	const value = {
		requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
			animationFrame = callback;
			return 11;
		}),
		cancelAnimationFrame: vi.fn(),
		requestIdleCallback: idle
			? vi.fn((callback: IdleRequestCallback) => {
					idleCallback = callback;
					return 22;
				})
			: undefined,
		cancelIdleCallback: vi.fn(),
		setTimeout: vi.fn((callback: () => void) => {
			timeoutCallback = callback;
			return 33;
		}),
		clearTimeout: vi.fn(),
	};

	return {
		value,
		runAnimationFrame: () => animationFrame?.(0),
		runIdleCallback: () => idleCallback?.({} as IdleDeadline),
		runTimeout: () => timeoutCallback?.(),
	};
}
