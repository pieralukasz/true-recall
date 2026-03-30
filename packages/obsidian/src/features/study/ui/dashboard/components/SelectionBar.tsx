import { Clickable } from "@true-recall/obsidian/components/Clickable";

interface SelectionBarProps {
	selectedCount: number;
	onSelectAll: () => void;
	onCreateProject: () => void;
	onArchive: () => void;
	onStudy: () => void;
	onCancel: () => void;
}

export function SelectionBar({
	selectedCount,
	onSelectAll,
	onCreateProject,
	onArchive,
	onStudy,
	onCancel,
}: SelectionBarProps) {
	const btnCls =
		"ep:px-2 ep:py-1 ep:rounded ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors";
	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:rounded-lg ep:mb-2 ep:text-ui-small">
			<span class="ep:text-obs-muted">{selectedCount} selected</span>
			<div class="ep:flex-1" />
			<Clickable class={btnCls} onClick={onSelectAll}>
				All
			</Clickable>
			<Clickable
				class={btnCls}
				onClick={onCreateProject}
				disabled={selectedCount === 0}
			>
				Create project
			</Clickable>
			<Clickable
				class={btnCls}
				onClick={onArchive}
				disabled={selectedCount === 0}
			>
				Archive
			</Clickable>
			<Clickable
				class={btnCls}
				onClick={onStudy}
				disabled={selectedCount === 0}
			>
				Study
			</Clickable>
			<Clickable class={btnCls} onClick={onCancel}>
				Cancel
			</Clickable>
		</div>
	);
}
