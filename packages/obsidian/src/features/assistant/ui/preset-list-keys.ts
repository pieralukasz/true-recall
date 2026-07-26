export interface PresetListKeyEvent {
	key: string;
}

/** Keyboard contract for the fast AI preset list, matching the menu it replaces:
 * arrows wrap, Home/End jump to the ends, anything else is not ours. Returns the
 * index to focus, or null when the key should fall through. */
export function resolvePresetListIndex(
	event: PresetListKeyEvent,
	current: number,
	count: number,
): number | null {
	if (count === 0) return null;

	switch (event.key) {
		case "ArrowDown":
			return (current + 1 + count) % count;
		case "ArrowUp":
			return (current - 1 + count) % count;
		case "Home":
			return 0;
		case "End":
			return count - 1;
		default:
			return null;
	}
}
