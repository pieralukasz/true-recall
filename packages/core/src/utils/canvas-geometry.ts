export interface RectLike {
	left: number;
	top: number;
	width: number;
	height: number;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function normalizePointFromRect(
	clientX: number,
	clientY: number,
	rect: RectLike,
): { x: number; y: number } | null {
	if (rect.width === 0 || rect.height === 0) return null;
	const x = clamp((clientX - rect.left) / rect.width, 0, 1);
	const y = clamp((clientY - rect.top) / rect.height, 0, 1);
	return { x, y };
}
