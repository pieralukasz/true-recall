/**
 * Collects rapid updates and commits only the last one once the source goes
 * quiet.
 *
 * CM6 reports a change per keystroke, and the assistant's proposal fields
 * commit straight into SQLite: an undebounced field rewrote the whole thread
 * manifest and invalidated every assistant query on every character, which
 * locks up the shared renderer all Obsidian windows run in.
 */
export interface DebouncedCommit<T> {
	push(value: T): void;
	/** Whether an edit is waiting — external syncs must not overwrite it. */
	hasPending(): boolean;
	/** Commit what is pending right now (blur, unmount, before applying). */
	flush(): void;
	cancel(): void;
}

export function createDebouncedCommit<T>(
	commit: (value: T) => void,
	delayMs: number,
): DebouncedCommit<T> {
	let timer: number | null = null;
	let pending: { value: T } | null = null;

	const clearTimer = () => {
		if (timer !== null) window.clearTimeout(timer);
		timer = null;
	};

	const flush = () => {
		clearTimer();
		const entry = pending;
		pending = null;
		if (entry) commit(entry.value);
	};

	return {
		push(value: T) {
			pending = { value };
			clearTimer();
			timer = window.setTimeout(flush, delayMs);
		},
		hasPending: () => pending !== null,
		flush,
		cancel() {
			clearTimer();
			pending = null;
		},
	};
}
