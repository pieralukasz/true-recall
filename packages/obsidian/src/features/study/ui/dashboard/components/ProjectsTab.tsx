import type { Signal } from "@preact/signals";
import type { RefObject } from "preact";

import type { DashboardProject } from "../types";
import { ProjectTree } from "./ProjectTree";
import { SelectionBar } from "./SelectionBar";
import { useProjectsTabModel } from "./useProjectsTabModel";

interface ProjectsTabProps {
	projects: DashboardProject[];
	searchQuery: string;
	scrollContainerRef: RefObject<HTMLDivElement>;
	scrollTop: Signal<number>;
	onStudyNote: (
		noteName: string,
		projectPath?: string,
		cardCount?: number,
	) => void;
	onPresetClick?: (path: string | null) => void;
}

export function ProjectsTab(props: ProjectsTabProps) {
	const model = useProjectsTabModel(props);
	const { projects, onStudyNote, onPresetClick } = props;
	const { plugin, flatItems, selection, bulk } = model;
	const { isSelecting, selectedCount, selectAll, exitSelection } = selection;
	const {
		handleCreateProjectFromSelected,
		handleAssignToProject,
		handleArchiveSelected,
		handleStudySelected,
	} = bulk;
	if (flatItems.length === 0) {
		return (
			<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
				{projects.length === 0
					? "No projects found. Organize notes in folders or add include: folder to a note's frontmatter."
					: "No matching projects."}
			</div>
		);
	}

	return (
		<div>
			{plugin.settings.rMode.enabled && !isSelecting && (
				<div
					aria-hidden="true"
					class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:h-6 ep:text-[9px] ep:uppercase ep:tracking-wide ep:text-obs-faint"
				>
					<span class="ep:flex-1" />
					<span class="ep:w-20 ep:text-center">Memory</span>
					<span class="ep:flex ep:gap-2 ep:shrink-0">
						<span class="ep:w-8 ep:text-right">New</span>
						<span class="ep:w-6 ep:text-right">Learn</span>
					</span>
					<span class="ep:w-11 ep:text-center">Reviews</span>
					<span class="ep:w-6" />
				</div>
			)}
			{isSelecting && (
				<SelectionBar
					selectedCount={selectedCount}
					onSelectAll={selectAll}
					onCreateProject={() => void handleCreateProjectFromSelected()}
					onAssignToProject={() => void handleAssignToProject()}
					onArchive={() => void handleArchiveSelected()}
					onStudy={handleStudySelected}
					onCancel={exitSelection}
				/>
			)}

			<ProjectTree
				model={model}
				onStudyNote={onStudyNote}
				onPresetClick={onPresetClick}
			/>
		</div>
	);
}
