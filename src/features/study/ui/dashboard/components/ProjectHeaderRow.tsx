import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import { useContextMenu } from "@shared/ui/preact/useContextMenu";
import { cn } from "@shared/ui/utils";
import { computePriority } from "../helpers/note-priority";
import type { DashboardProject, NotePriority } from "../types";

const PRIORITY_DOT: Record<NotePriority, string> = {
	overdue: "ep:bg-obs-red",
	hot: "ep:bg-obs-orange",
	due: "ep:bg-obs-blue",
	light: "ep:bg-obs-green",
	done: "ep:bg-obs-faint",
};

interface ProjectHeaderRowProps {
	project: DashboardProject;
	depth: number;
	isExpanded: boolean;
	isVirtual?: boolean;
	onToggle: () => void;
	onStudyProject: () => void;
	onCustomStudy: () => void;
	onNavigate?: () => void;
	onPresetClick?: (projectPath: string) => void;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onRename?: () => void;
}

export function ProjectHeaderRow({
	project,
	depth,
	isExpanded,
	isVirtual,
	onToggle,
	onStudyProject,
	onCustomStudy,
	onNavigate,
	onPresetClick,
	onArchive,
	onUnarchive,
	onRename,
}: ProjectHeaderRowProps) {
	const _activeDue = project.due + project.newCount + project.learning;
	const priority = computePriority({
		overdueCount: 0,
		due: project.due,
		learning: project.learning,
		newCount: project.newCount,
	});

	const menuItems = isVirtual
		? [
				{ title: "Study", icon: "play" as const, onClick: onStudyProject },
				{
					title: "Custom session",
					icon: "sliders-horizontal" as const,
					onClick: onCustomStudy,
				},
			]
		: [
				{
					title: "Study project",
					icon: "play" as const,
					onClick: onStudyProject,
				},
				{
					title: "Custom session",
					icon: "sliders-horizontal" as const,
					onClick: onCustomStudy,
				},
				{
					title: "Go to project note",
					icon: "file-text" as const,
					onClick: onNavigate!,
				},
				{
					title: "Rename",
					icon: "pencil" as const,
					onClick: () => onRename?.(),
				},
				{
					title: "Pick preset",
					icon: "settings-2" as const,
					onClick: () => onPresetClick?.(project.path),
				},
				project.archived
					? {
							title: "Unarchive project",
							icon: "archive-restore" as const,
							onClick: () => onUnarchive?.(),
						}
					: {
							title: "Archive project",
							icon: "archive" as const,
							onClick: () => onArchive?.(),
						},
			];

	const handleContextMenu = useContextMenu(menuItems);

	return (
		<Clickable
			class={cn(
				"ep:flex ep:items-center ep:gap-2 ep:px-3 ep:h-9 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				project.archived && "ep:opacity-50",
			)}
			style={{ paddingLeft: `${12 + depth * 20}px` }}
			onContextMenu={handleContextMenu}
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
					<Clickable
						class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-active-hover ep:transition-colors ep:shrink-0"
						onClick={() => onPresetClick?.(project.path)}
						title={`FSRS preset: ${project.presetName}`}
					>
						{project.presetName}
					</Clickable>
				)}

				<span class="ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums">
					{project.totalMembers}
					{project.totalMembers === 1 ? " note" : " notes"}
					{project.healthPct > 0 && ` · ${project.healthPct}%`}
				</span>
			</div>

			<CardCountDisplay
				newCount={project.newCount}
				learningCount={project.learning}
				dueCount={project.due}
			/>

			<IconButton
				icon="play"
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
