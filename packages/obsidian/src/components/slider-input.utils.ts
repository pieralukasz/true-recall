/**
 * Value math for the slider's manual entry box. Pure so the rounding and
 * clamping rules are testable without rendering.
 */

/** Decimal places implied by the step, so typed values round like the track does */
export function decimalsOf(step: number): number {
	const text = String(step);
	const dot = text.indexOf(".");
	return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Round a typed number onto the nearest position the slider can represent, then
 * clamp it. `allowAboveMax` is for sliders whose ceiling grows with the current
 * value — there the typed number wins and the track rescales around it.
 */
export function snapToStep(
	raw: number,
	min: number,
	max: number,
	step: number,
	allowAboveMax = false,
): number {
	const stepped = min + Math.round((raw - min) / step) * step;
	const value = Number(stepped.toFixed(decimalsOf(step)));
	if (value < min) return min;
	if (value > max && !allowAboveMax) return max;
	return value;
}
