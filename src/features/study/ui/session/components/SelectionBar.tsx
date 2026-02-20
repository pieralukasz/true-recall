interface SelectionBarProps {
	count: number;
	onStart: () => void;
	onMove: () => void;
	onAddProject: () => void;
	onClear: () => void;
}

export function SelectionBar({
	count,
	onStart,
	onMove,
	onAddProject,
	onClear,
}: SelectionBarProps) {
	const btnCls =
		"ep:py-1.5 ep:px-3 ep:text-ui-small ep:bg-obs-border ep:text-obs-normal ep:border-none ep:rounded-md ep:cursor-pointer ep:hover:bg-obs-modifier-hover";
	return (
		<div class="true-recall-session-selection-bar ep:hidden ep:md:flex ep:items-center ep:justify-between ep:p-3 ep:mt-2 ep:bg-obs-secondary ep:rounded-md ep:gap-3 ep:shrink-0">
			<span class="ep:text-ui-small ep:text-obs-muted ep:font-medium">
				{count} note{count > 1 ? "s" : ""} selected
			</span>
			<div class="ep:flex ep:gap-2">
				<button type="button" class={btnCls} onClick={onMove}>
					Move
				</button>
				<button type="button" class={btnCls} onClick={onAddProject}>
					Add to project
				</button>
				<button type="button" class={btnCls} onClick={onClear}>
					Clear
				</button>
				<button
					type="button"
					class="mod-cta ep:py-1.5 ep:px-4 ep:text-ui-small"
					onClick={onStart}
				>
					Start Session
				</button>
			</div>
		</div>
	);
}
