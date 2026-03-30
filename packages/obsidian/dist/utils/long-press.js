/** Default long press duration in milliseconds */
export const LONG_PRESS_DURATION = 500;
/**
 * Setup long press detection on an element
 *
 * @param element - The element to attach long press detection to
 * @param events - EventRegistry for automatic cleanup
 * @param options - Long press options
 * @returns Object with didLongPress getter to check if long press was triggered
 *
 * @example
 * ```typescript
 * const { didLongPress } = setupLongPress(element, this.events, {
 *   onLongPress: () => this.enterSelectionMode()
 * });
 *
 * // Later in click handler:
 * if (!didLongPress()) {
 *   this.handleNormalClick();
 * }
 * ```
 */
export function setupLongPress(element, events, options) {
    var _a;
    const duration = (_a = options.duration) !== null && _a !== void 0 ? _a : LONG_PRESS_DURATION;
    let longPressTimer = null;
    let wasLongPress = false;
    events.addEventListener(element, "pointerdown", () => {
        wasLongPress = false;
        longPressTimer = setTimeout(() => {
            wasLongPress = true;
            options.onLongPress();
            longPressTimer = null;
        }, duration);
    });
    events.addEventListener(element, "pointerup", () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
    events.addEventListener(element, "pointerleave", () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
    // Also handle pointercancel for edge cases
    events.addEventListener(element, "pointercancel", () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
    return {
        didLongPress: () => wasLongPress,
    };
}
