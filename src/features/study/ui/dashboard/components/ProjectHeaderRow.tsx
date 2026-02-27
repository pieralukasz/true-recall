import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import { useIcon } from "@shared/ui/preact/hooks";
import { cn } from "@shared/ui/utils";
import { healthColor } from "../../editor/widgets/project-stats";
import type { DashboardProject } from "../types";

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
	const chevronRef = useIcon(
		isExpanded ? "chevron-down" : "chevron-right",
	);

	const activeDue = project.due + project.newCount + project.learning;
	const color = healthColor(project.healthPct);

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
					ref={chevronRef}
					class="[&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5 ep:text-obs-muted ep:shrink-0"
				/>

				<span
					class="ep:w-2 ep:h-2 ep:rounded-full ep:shrink-0"
					style={{ backgroundColor: color }}
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
				icon="play"
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
