import type { ComponentChildren } from "preact";
import { useCallback, useState } from "preact/hooks";

import { cn } from "@true-recall/obsidian/utils/cn";

interface ReorderableListProps<T> {
	items: readonly T[];
	getKey: (item: T) => string;
	/** `from`/`to` are indices into `items`; `to` is the final resting slot. */
	onReorder: (from: number, to: number) => void;
	renderItem: (item: T, index: number) => ComponentChildren;
	/** Announced on the grab handle, e.g. "Reorder Simplify wording". */
	getMoveLabel?: (item: T) => string;
	class?: string;
}

/**
 * Vertical list whose rows can be reordered by dragging the grab handle, or by
 * focusing it and pressing the arrow keys. The row content is opaque to this
 * component — it only owns the handle and the drag state.
 */
export function ReorderableList<T>({
	items,
	getKey,
	onReorder,
	renderItem,
	getMoveLabel,
	class: className,
}: ReorderableListProps<T>) {
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	const endDrag = useCallback(() => {
		setDragIndex(null);
		setDragOverIndex(null);
	}, []);

	const handleDrop = useCallback(
		(event: DragEvent, dropIndex: number) => {
			event.preventDefault();
			if (dragIndex !== null && dragIndex !== dropIndex) {
				onReorder(dragIndex, dropIndex);
			}
			endDrag();
		},
		[dragIndex, onReorder, endDrag],
	);

	const handleHandleKeyDown = useCallback(
		(event: KeyboardEvent, index: number) => {
			const delta =
				event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
			if (delta === 0) return;
			const target = index + delta;
			if (target < 0 || target >= items.length) return;
			event.preventDefault();
			onReorder(index, target);
		},
		[items.length, onReorder],
	);

	if (items.length === 0) return null;

	return (
		<div class={cn("tr-preset-list", className)}>
			{items.map((item, index) => (
				// biome-ignore lint/a11y/noStaticElementInteractions: drop target for the row's grab handle
				<div
					key={getKey(item)}
					class={cn(
						"tr-preset-list__item",
						dragIndex === index && "ep:opacity-40",
						dragOverIndex === index &&
							dragIndex !== index &&
							"ep:bg-obs-modifier-hover",
					)}
					onDragOver={(event) => {
						event.preventDefault();
						if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
						setDragOverIndex(index);
					}}
					onDrop={(event) => handleDrop(event, index)}
				>
					<button
						type="button"
						draggable
						aria-label={getMoveLabel?.(item) ?? `Reorder item ${index + 1}`}
						title="Drag to reorder, or use the arrow keys"
						class="tr-preset-list__handle"
						onDragStart={(event) => {
							setDragIndex(index);
							if (event.dataTransfer) {
								event.dataTransfer.effectAllowed = "move";
								event.dataTransfer.setData("text/plain", String(index));
							}
						}}
						onDragEnd={endDrag}
						onKeyDown={(event) => handleHandleKeyDown(event, index)}
					>
						<span aria-hidden="true">&#x2261;</span>
					</button>
					<div class="tr-preset-list__content">{renderItem(item, index)}</div>
				</div>
			))}
		</div>
	);
}
