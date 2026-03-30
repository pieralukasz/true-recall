/**
 * Preact hooks for the QueryRuntime.
 *
 * These hooks provide reactive access to cached query results.
 * Since QueryRuntime stores results as Preact signals, components
 * that read .value automatically re-render when data changes.
 *
 * Usage:
 *   const allCards = useQuerySignal<Map<string, FSRSFlashcardItem>>(QK.ALL_CARDS);
 *   // allCards is a ReadonlySignal — read allCards.value in JSX for auto-tracking
 */

import type { ReadonlySignal } from "@preact/signals";
import { signal } from "@preact/signals";
import type { QueryKey } from "@true-recall/obsidian/services/query-runtime";

// The singleton runtime instance, set during plugin init
let _runtime: import("@true-recall/obsidian/services/query-runtime").QueryRuntime | null =
	null;

const EMPTY_SIGNAL = signal(undefined);

/**
 * Set the global QueryRuntime instance. Called once from main.ts.
 */
export function setQueryRuntime(
	runtime: import("@true-recall/obsidian/services/query-runtime").QueryRuntime,
): void {
	_runtime = runtime;
}

/**
 * Get the global QueryRuntime instance.
 */
export function getQueryRuntime(): import("@true-recall/obsidian/services/query-runtime").QueryRuntime {
	if (!_runtime) throw new Error("QueryRuntime not initialized");
	return _runtime;
}

/**
 * Get the signal for a registered query.
 * Returns a ReadonlySignal that auto-tracks in Preact components.
 *
 * If the query is not registered, returns a signal with `undefined`.
 */
export function useQuerySignal<T>(key: QueryKey): ReadonlySignal<T> {
	if (!_runtime) return EMPTY_SIGNAL as ReadonlySignal<T>;
	return (
		_runtime.signal<T>(key) ?? (EMPTY_SIGNAL as ReadonlySignal<T>)
	);
}
