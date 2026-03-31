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
import { signal } from "@preact/signals";
// The singleton runtime instance, set during plugin init
let _runtime = null;
const EMPTY_SIGNAL = signal(undefined);
/**
 * Set the global QueryRuntime instance. Called once from main.ts.
 */
export function setQueryRuntime(runtime) {
    _runtime = runtime;
}
/**
 * Get the global QueryRuntime instance.
 */
export function getQueryRuntime() {
    if (!_runtime)
        throw new Error("QueryRuntime not initialized");
    return _runtime;
}
/**
 * Get the signal for a registered query.
 * Returns a ReadonlySignal that auto-tracks in Preact components.
 *
 * If the query is not registered, returns a signal with `undefined`.
 */
export function useQuerySignal(key) {
    var _a;
    if (!_runtime)
        return EMPTY_SIGNAL;
    return ((_a = _runtime.signal(key)) !== null && _a !== void 0 ? _a : EMPTY_SIGNAL);
}
