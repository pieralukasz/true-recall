import type { PanelItem } from "@true-recall/obsidian/features/library/ui/panel/group-cards";

/** Card ids a panel row stands for (an image occlusion group selects all its cards). */
export function getPanelItemCardIds(item: PanelItem): string[] {
	return item.type === "io-group"
		? item.cards.map((card) => card.id)
		: [item.card.id];
}

/**
 * A drag started on a row takes that row's new state: unselected → add, fully selected → remove.
 */
export function getDragSelectMode(
	anchorCardIds: readonly string[],
	selected: ReadonlySet<string>,
): "add" | "remove" {
	return anchorCardIds.length > 0 &&
		anchorCardIds.every((id) => selected.has(id))
		? "remove"
		: "add";
}

/**
 * Selection after dragging from `anchorIndex` to `overIndex`: every row in between
 * gets the drag's state, rows outside the range keep their state from `base`.
 */
export function computeDragSelection({
	rows,
	base,
	anchorIndex,
	overIndex,
	mode,
}: {
	rows: readonly (readonly string[])[];
	base: ReadonlySet<string>;
	anchorIndex: number;
	overIndex: number;
	mode: "add" | "remove";
}): string[] {
	const next = new Set(base);
	const from = Math.max(0, Math.min(anchorIndex, overIndex));
	const to = Math.min(rows.length - 1, Math.max(anchorIndex, overIndex));
	for (let index = from; index <= to; index++) {
		for (const id of rows[index] ?? []) {
			if (mode === "add") next.add(id);
			else next.delete(id);
		}
	}
	return [...next];
}
