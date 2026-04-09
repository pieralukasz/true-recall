import { PRIORITY_DOT } from "@true-recall/core/helpers/note-priority";

import {
	CardCountDisplay,
	Clickable,
	IconButton,
} from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";
import { isMobile } from "@true-recall/obsidian/utils/platform";

import type { DashboardNoteEntry } from "../types";

export interface NoteRowProps {
	note: DashboardNoteEntry;
	onNavigate: () => void;
	onStudy: () => void;
	onCustomStudy?: () => void;
	onProjectClick?: (projectName: string) => void;
	onPresetClick?: (notePath: string | null) => void;
	onContextMenu?: (e: MouseEvent) => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onRename?: () => void;
	onDetach?: () => void;
	isSelectionMode?: boolean;
	isSelected?: boolean;
	onToggleSelect?: () => void;
	onEnterSelection?: () => void;
}

export function NoteRow({
	note,
	onNavigate,
	onStudy,
	onProjectClick,
	onPresetClick,
	onContextMenu,
	isSelectionMode,
	isSelected,
	onToggleSelect,
	onEnterSelection,
}: NoteRowProps) {
	const handleClick = (e: MouseEvent | KeyboardEvent) => {
		const isModifier = "metaKey" in e && (e.metaKey || e.ctrlKey);

		if (isModifier && !isSelectionMode) {
			onEnterSelection?.();
		} else if (isModifier && isSelectionMode) {
			onToggleSelect?.();
		} else if (isSelectionMode) {
			(onToggleSelect ?? onNavigate)();
		} else {
			onNavigate();
		}
	};

	return (
		<Clickable
			class={cn(
				"ep:flex ep:items-center ep:gap-3 ep:px-3 ep:h-9 ep:overflow-hidden ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				note.archived && "ep:opacity-50",
				isSelected && "ep:bg-obs-modifier-hover",
			)}
			onContextMenu={isSelectionMode ? undefined : onContextMenu}
			onClick={handleClick}
			stopPropagation={false}
		>
			{isSelectionMode && (
				<input
					type="checkbox"
					checked={isSelected}
					class="ep:shrink-0"
					onClick={(e) => {
						e.stopPropagation();
						onToggleSelect?.();
					}}
				/>
			)}

			<div class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0 ep:hover:text-obs-interactive ep:transition-colors">
				<span
					class={cn(
						"ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full ep:shrink-0",
						PRIORITY_DOT[note.priority],
					)}
				/>
				<span
					class={cn(
						"ep:text-sm ep:text-obs-normal ep:truncate",
						note.archived && "ep:line-through",
					)}
					title={note.name}
				>
					{note.name}
				</span>
				{!isMobile() && note.presetName && (
					<Clickable
						class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-active-hover ep:transition-colors ep:shrink-0"
						title={`FSRS preset: ${note.presetName}`}
						onClick={() => onPresetClick?.(note.path)}
					>
						{note.presetName}
					</Clickable>
				)}
			</div>

			{!isMobile() && note.projects.length > 0 && (
				<div
					class="ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:max-w-[200px] ep:overflow-hidden"
					title={note.projects.join(", ")}
				>
					{note.projects.slice(0, 2).map((projectName) => (
						<Clickable
							key={projectName}
							class="ep:px-1.5 ep:py-0.5 ep:text-[10px] ep:leading-tight ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-active-hover ep:transition-colors ep:truncate ep:max-w-[90px] ep:shrink-0"
							onClick={() => onProjectClick?.(projectName)}
						>
							{projectName}
						</Clickable>
					))}
					{note.projects.length > 2 && (
						<span class="ep:text-[10px] ep:text-obs-faint ep:shrink-0">
							+{note.projects.length - 2}
						</span>
					)}
				</div>
			)}

			<CardCountDisplay
				newCount={note.newCount}
				learningCount={note.learning}
				dueCount={note.due}
			/>

			{!isSelectionMode && (
				<div class="ep:flex ep:items-center">
					<IconButton
						icon="play"
						ariaLabel={`Study ${note.name}`}
						onClick={onStudy}
						size="small"
					/>
				</div>
			)}
		</Clickable>
	);
}
