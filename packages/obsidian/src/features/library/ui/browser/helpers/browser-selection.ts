export interface SelectModifiers {
	shiftKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
}

interface CardRef {
	id: string;
}

/**
 * Next selection for a row click.
 *
 * - Ctrl/Cmd toggles the row.
 * - Shift adds the range between the last selected row and the clicked row.
 * - A plain click selects only that row, or clears it when it was the sole
 *   selection.
 */
export function applySelectionClick(
	selected: ReadonlySet<string>,
	cardId: string,
	modifiers: SelectModifiers | undefined,
	cards: readonly CardRef[],
): Set<string> {
	const next = new Set(selected);

	if (modifiers?.ctrlKey || modifiers?.metaKey) {
		if (next.has(cardId)) next.delete(cardId);
		else next.add(cardId);
		return next;
	}

	if (modifiers?.shiftKey && cards.length > 0) {
		const anchor = Array.from(selected).pop();
		if (!anchor) return next;
		const anchorIdx = cards.findIndex((c) => c.id === anchor);
		const targetIdx = cards.findIndex((c) => c.id === cardId);
		if (anchorIdx < 0 || targetIdx < 0) return next;
		const [from, to] =
			anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
		for (let i = from; i <= to; i++) {
			const card = cards[i];
			if (card) next.add(card.id);
		}
		return next;
	}

	if (next.has(cardId) && next.size === 1) return new Set();
	return new Set([cardId]);
}

/**
 * "Select all" covers every card matching the current query, not only the
 * loaded page. When everything is already selected it clears instead.
 */
export function toggleSelectAll(
	selected: ReadonlySet<string>,
	totalCount: number,
	getMatchingIds: () => readonly string[],
): Set<string> {
	if (selected.size === totalCount) return new Set();
	return new Set(getMatchingIds());
}

/** Drop the given ids; returns the same set when nothing changed. */
export function withoutIds(
	selected: ReadonlySet<string>,
	ids: Iterable<string>,
): ReadonlySet<string> {
	const drop = new Set(ids);
	let changed = false;
	const next = new Set<string>();
	for (const id of selected) {
		if (drop.has(id)) changed = true;
		else next.add(id);
	}
	return changed ? next : selected;
}

/**
 * Keep only ids that still match the current query. Bulk actions act on the
 * selection, so ids hidden by a filter change or removed by a mutation must
 * not stay selected. Returns the same set when nothing changed.
 */
export function retainMatchingIds(
	selected: ReadonlySet<string>,
	matching: ReadonlySet<string>,
): ReadonlySet<string> {
	let changed = false;
	const next = new Set<string>();
	for (const id of selected) {
		if (matching.has(id)) next.add(id);
		else changed = true;
	}
	return changed ? next : selected;
}
