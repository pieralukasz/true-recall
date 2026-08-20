/**
 * Move an item to a new position, shifting the rest.
 *
 * `to` is interpreted after the item has been lifted out, which is what
 * drag-and-drop reordering expects: dropping item 0 onto index 2 lands it
 * third, not second. Out-of-range indices return an unchanged copy.
 */
export function moveItem<T>(
	items: readonly T[],
	from: number,
	to: number,
): T[] {
	const next = [...items];
	if (from === to) return next;
	if (from < 0 || from >= items.length) return next;
	if (to < 0 || to >= items.length) return next;

	const [moved] = next.splice(from, 1);
	if (moved === undefined) return [...items];
	next.splice(to, 0, moved);
	return next;
}

/**
 * Reorder only the items matching `isMovable`, leaving the others pinned to
 * their slots. `from` and `to` index the movable subset, not the whole list —
 * which is what a UI showing just that subset (e.g. user presets among
 * built-ins) hands back.
 */
export function moveItemAmong<T>(
	items: readonly T[],
	isMovable: (item: T) => boolean,
	from: number,
	to: number,
): T[] {
	const movable = items.filter(isMovable);
	const reordered = moveItem(movable, from, to);
	let cursor = 0;
	return items.map((item) =>
		isMovable(item) ? (reordered[cursor++] ?? item) : item,
	);
}
