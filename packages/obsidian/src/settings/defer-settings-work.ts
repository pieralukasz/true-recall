interface SettingsWorkScheduler {
	requestAnimationFrame: (callback: FrameRequestCallback) => number;
	cancelAnimationFrame: (handle: number) => void;
	requestIdleCallback?: (
		callback: IdleRequestCallback,
		options?: IdleRequestOptions,
	) => number;
	cancelIdleCallback?: (handle: number) => void;
	setTimeout: (callback: () => void, delay: number) => number;
	clearTimeout: (handle: number) => void;
}

/**
 * Defer collection-wide settings work until after the current settings window
 * has painted. Capturing activeWindow is important now that Obsidian can host
 * Settings in a separate window.
 */
export function deferSettingsWork(
	work: () => void,
	scheduler: SettingsWorkScheduler = activeWindow,
): () => void {
	let cancelled = false;
	let idleId: number | null = null;
	let timeoutId: number | null = null;

	const run = () => {
		if (!cancelled) work();
	};
	const rafId = scheduler.requestAnimationFrame(() => {
		if (cancelled) return;
		if (scheduler.requestIdleCallback) {
			idleId = scheduler.requestIdleCallback(run, { timeout: 250 });
		} else {
			timeoutId = scheduler.setTimeout(run, 0);
		}
	});

	return () => {
		cancelled = true;
		scheduler.cancelAnimationFrame(rafId);
		if (idleId !== null) scheduler.cancelIdleCallback?.(idleId);
		if (timeoutId !== null) scheduler.clearTimeout(timeoutId);
	};
}
