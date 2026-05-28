import {
	computePriority,
	PRIORITY_DOT,
} from "@true-recall/core/helpers/note-priority";

import {
	CardCountDisplay,
	Clickable,
	IconButton,
	PlayIcon,
} from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

import type { DashboardProject } from "../types";

interface ProjectHeaderRowProps {
	project: DashboardProject;
	depth: number;
	isExpanded: boolean;
	isVirtual?: boolean;
	onToggle: () => void;
	onStudyProject: () => void;
	onCustomStudy?: () => void;
	onNavigate?: () => void;
	onPresetClick?: (path: string | null) => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onRename?: () => void;
	onContextMenu?: (e: MouseEvent) => void;
}

export function ProjectHeaderRow({
	project,
	depth,
	isExpanded: _isExpanded,
	isVirtual,
	onToggle,
	onStudyProject,
	onContextMenu,
}: ProjectHeaderRowProps) {
	const priority = computePriority({
		overdueCount: 0,
		due: project.due,
		learning: project.learning,
		newCount: project.newCount,
	});

	return (
		<Clickable
			class={cn(
				"ep:flex ep:items-center ep:gap-2 ep:px-3 ep:h-9 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				project.archived && "ep:opacity-50",
			)}
			style={{ paddingLeft: `${12 + depth * 20}px` }}
			onContextMenu={onContextMenu}
			onClick={onToggle}
			stopPropagation={false}
		>
			<div class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0">
				<span
					class={cn(
						"ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full ep:shrink-0",
						PRIORITY_DOT[priority],
					)}
				/>
				<span
					class={cn(
						"ep:text-sm ep:truncate ep:min-w-0 ep:font-medium",
						isVirtual ? "ep:text-obs-muted ep:italic" : "ep:text-obs-normal",
						project.archived && "ep:line-through",
					)}
				>
					{project.name}
				</span>

				{project.presetName && (
					<span
						class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:shrink-0"
						title={`FSRS preset: ${project.presetName}`}
					>
						{project.presetName}
					</span>
				)}

				<span class="ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums">
					{project.totalMembers}
					{project.totalMembers === 1 ? " note" : " notes"}
				</span>
			</div>

			<CardCountDisplay
				newCount={project.newCount}
				learningCount={project.learning}
				dueCount={project.due}
			/>

			<IconButton
				icon="play"
				customIcon={<PlayIcon />}
				ariaLabel={`Study ${project.name}`}
				onClick={onStudyProject}
				size="small"
			/>
		</Clickable>
	);
}

export function EmptyProjectRow({ depth }: { depth: number }) {
	return (
		<div
			class="ep:text-xs ep:text-obs-muted ep:px-3 ep:flex ep:items-center ep:h-9"
			style={{ paddingLeft: `${12 + (depth + 1) * 20}px` }}
		>
			No member notes
		</div>
	);
}
