/**
 * Anki-style leech trigger logic.
 * Fires at exactly `threshold` lapses, then every `ceil(threshold / 2)` after that.
 * E.g. threshold=8 → triggers at 8, 12, 16, 20, ...
 */
export declare function shouldTriggerLeech(lapses: number, threshold: number): boolean;
