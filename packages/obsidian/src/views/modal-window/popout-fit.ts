/**
 * Height math for popout windows that resize themselves to fit their content.
 *
 * The two coordinate systems involved are easy to confuse:
 *
 *   - `innerWidth`/`innerHeight` and every DOM measurement are CSS pixels, so
 *     they follow Obsidian's zoom level.
 *   - `outerWidth`/`outerHeight` and `window.resizeTo()` are screen pixels and
 *     ignore zoom.
 *
 * At the default zoom the two are identical, which is why passing a CSS-pixel
 * height straight to `resizeTo()` looks correct until someone zooms.
 */

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export interface PopoutFitInput {
	/** Height of the custom drag bar, in CSS px. */
	dragBarHeight: number;
	/** Natural height of the view content, in CSS px. */
	contentHeight: number;
	/** Combined vertical padding of the scroll body, in CSS px. */
	bodyPadding: number;
	/** `window.innerHeight` of the popout, in CSS px. */
	viewportHeight: number;
	/** Height of the leaf's `.view-content`, in CSS px. */
	viewContentHeight: number;
	/** `window.outerWidth` of the popout, in screen px. */
	outerWidth: number;
	/** `window.innerWidth` of the popout, in CSS px. */
	innerWidth: number;
	/** Lower bound for the resulting window height, in screen px. */
	minOuterHeight: number;
	/** Upper bound for the resulting window height, in screen px. */
	maxOuterHeight: number;
}

/**
 * Screen pixels per CSS pixel, read off the width axis.
 *
 * Width is the safe axis: it stays constant while the height is being fitted,
 * so it never hits the frame where `outerHeight` still reports the pre-resize
 * value while `innerHeight` already reports the new one.
 */
export function cssToScreenScale(
	outerWidth: number,
	innerWidth: number,
): number {
	if (!Number.isFinite(outerWidth) || !Number.isFinite(innerWidth)) return 1;
	if (innerWidth <= 0) return 1;
	const scale = outerWidth / innerWidth;
	if (scale < MIN_SCALE || scale > MAX_SCALE) return 1;
	return scale;
}

/**
 * Window height, in screen px, that makes the popout viewport exactly as tall
 * as its content. Returns `null` when the content cannot be measured.
 *
 * Deliberately independent of the current `outerHeight`: deriving the next
 * height from the previous one lets a single stale read inflate the window on
 * every pass.
 */
export function computeFitOuterHeight(input: PopoutFitInput): number | null {
	const naturalCss =
		input.dragBarHeight + input.contentHeight + input.bodyPadding;
	if (!Number.isFinite(naturalCss)) return null;

	// Whatever the popout viewport spends above the view — Obsidian's tab
	// header — is not ours to shrink, so it is added on top of the content.
	const chromeCss =
		input.viewportHeight > 0 && input.viewContentHeight > 0
			? Math.max(0, input.viewportHeight - input.viewContentHeight)
			: 0;

	const scale = cssToScreenScale(input.outerWidth, input.innerWidth);
	const target = Math.round((naturalCss + chromeCss) * scale);
	if (!Number.isFinite(target)) return null;

	return Math.max(input.minOuterHeight, Math.min(input.maxOuterHeight, target));
}

export interface CenterPositionInput {
	/** Window size to centre, in screen px. */
	outerWidth: number;
	outerHeight: number;
	/** Usable screen area, in screen px (`window.screen.avail*`). */
	availLeft: number;
	availTop: number;
	availWidth: number;
	availHeight: number;
}

/**
 * Top-left corner that centres a window of the given size in the usable screen
 * area.
 *
 * The size is passed in rather than read from the window because callers centre
 * right after resizing, and `outerWidth`/`outerHeight` can still report the
 * pre-resize size on that frame — centring the window for a size it no longer
 * has.
 */
export function computeCenteredPosition(input: CenterPositionInput): {
	left: number;
	top: number;
} {
	return {
		left:
			input.availLeft +
			Math.max(0, Math.round((input.availWidth - input.outerWidth) / 2)),
		top:
			input.availTop +
			Math.max(0, Math.round((input.availHeight - input.outerHeight) / 2)),
	};
}
