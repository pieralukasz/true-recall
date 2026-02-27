import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
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
	onToggle: () => void;
	onStudyProject: () => void;
}

export function ProjectHeaderRow({
	project,
	depth,
	isExpanded,
	onToggle,
	onStudyProject,
}: ProjectHeaderRowProps) {
	const activeDue = project.due + project.newCount + project.learning;
	const priority = computePriority({ overdueCount: 0, due: project.due, learning: project.learning, newCount: project.newCount });

	return (
		<div
			class={cn(
				"ep:flex ep:items-center ep:gap-2 ep:px-3 ep:h-9 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
				activeDue === 0 && "ep:opacity-40",
			)}
			style={{ paddingLeft: `${12 + depth * 20}px` }}
		>
			<Clickable
				class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0"
				onClick={onToggle}
			>
				<span
					class={cn(
						"ep:inline-block ep:w-1.5 ep:h-1.5 ep:rounded-full ep:shrink-0",
						PRIORITY_DOT[priority],
					)}
				/>
				<span class="ep:text-sm ep:text-obs-normal ep:truncate ep:min-w-0 ep:font-medium">
					{project.name}
				</span>

				{project.presetName && (
					<span class="ep:text-[10px] ep:px-1.5 ep:py-0.5 ep:rounded-full ep:bg-obs-modifier-hover ep:text-obs-muted ep:shrink-0">
						{project.presetName}
					</span>
				)}

				<span class="ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums">
					{project.totalMembers}
					{project.totalMembers === 1 ? " note" : " notes"}
					{project.healthPct > 0 && ` · ${project.healthPct}%`}
				</span>
			</Clickable>

			<CardCountDisplay
				newCount={project.newCount}
				learningCount={project.learning}
				dueCount={project.due}
			/>

			<IconButton
				icon="brain"
				ariaLabel={`Study ${project.name}`}
				onClick={onStudyProject}
				size="small"
			/>
		</div>
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
