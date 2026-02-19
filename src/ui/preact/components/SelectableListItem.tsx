import type { ComponentChildren } from "preact";

export interface SelectableListItemProps {
	onSelect: () => void;
	selected?: boolean;
	children: ComponentChildren;
	right?: ComponentChildren;
}

export function SelectableListItem({ onSelect, selected = false, children, right }: SelectableListItemProps) {
	return (
		<div
			class={`ep:flex ep:justify-between ep:items-center ep:py-2.5 ep:px-3 ep:rounded-md ep:mb-1 ep:cursor-pointer ep:bg-obs-secondary ep:transition-colors ep:hover:bg-obs-modifier-hover ${selected ? "ep-selectable-highlight" : ""}`}
			onClick={onSelect}
		>
			<div class="ep:flex-1 ep:min-w-0">{children}</div>
			{right && <div class="ep:shrink-0">{right}</div>}
		</div>
	);
}
