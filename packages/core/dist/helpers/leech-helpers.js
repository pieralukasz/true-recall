/**
 * Anki-style leech trigger logic.
 * Fires at exactly `threshold` lapses, then every `ceil(threshold / 2)` after that.
 * E.g. threshold=8 → triggers at 8, 12, 16, 20, ...
 */
export function shouldTriggerLeech(lapses, threshold) {
    if (threshold <= 0)
        return false;
    if (lapses < threshold)
        return false;
    const halfThreshold = Math.max(1, Math.ceil(threshold / 2));
    return (lapses - threshold) % halfThreshold === 0;
}
