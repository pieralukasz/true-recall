/** Lapses a card may accumulate before it counts as a leech. */
export const DEFAULT_LEECH_THRESHOLD = 8;

/**
 * Whether a card currently sits at or past its leech threshold.
 *
 * {@link shouldTriggerLeech} answers a different question: should a warning
 * fire *right now*. It deliberately skips most lapses so the notification does
 * not repeat on every failure, which makes it useless for anything persistent.
 * Use this one to render state.
 */
export function isLeech(lapses: number, threshold: number): boolean {
	if (threshold <= 0) return false;
	return lapses >= threshold;
}

/**
 * Anki-style leech trigger logic.
 * Fires at exactly `threshold` lapses, then every `ceil(threshold / 2)` after that.
 * E.g. threshold=8 → triggers at 8, 12, 16, 20, ...
 */
export function shouldTriggerLeech(lapses: number, threshold: number): boolean {
	if (threshold <= 0) return false;
	if (lapses < threshold) return false;
	const halfThreshold = Math.max(1, Math.ceil(threshold / 2));
	return (lapses - threshold) % halfThreshold === 0;
}
