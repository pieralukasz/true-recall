import { NoteHubNoteRow } from "@features/library/ui/note-hub/components/NoteHubNoteRow";
import type { SelectionMode } from "@shared/store";
import type { ProjectInfo } from "@shared/types";
import { CardCountDisplay, IconButton } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact/hooks";
import { useCallback } from "preact/hooks";

export interface ProjectGroupProps {
	project: ProjectInfo;
	isExpanded: boolean;
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	onToggleExpand: (projectId: string) => void;
	onToggleNoteSelection: (notePath: string) => void;
	onEnterSelectionMode: (notePath: string) => void;
	onOpenNote: (path: string) => void;
	onStartReview: (filter: {
		sourceNoteFilters?: string[];
		projectFilters?: string[];
	}) => void;
	onStartReviewProject: (projectName: string) => void;
	onCustomStudyProject: (projectName: string) => void;
	onCustomStudyNote: (filter: { sourceNoteFilters: string[] }) => void;
	onGenerateCards: (notePath: string) => void;
	onAddToProject: (notePath: string) => void;
	onRemoveFromProject: (notePath: string, projectName: string) => void;
	onAddNotesToProject: (projectName: string) => void;
}

export function ProjectGroup({
	project,
	isExpanded,
	selectionMode,
	selectedNotePaths,
	onToggleExpand,
	onToggleNoteSelection,
	onEnterSelectionMode,
	onOpenNote,
	onStartReview,
	onStartReviewProject,
	onCustomStudyProject,
	onCustomStudyNote,
	onGenerateCards,
	onAddToProject,
	onRemoveFromProject,
	onAddNotesToProject,
}: ProjectGroupProps) {
	const chevronRef = useIcon(isExpanded ? "chevron-down" : "chevron-right");
	const noteText =
		project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;

	const handleHeaderClick = useCallback(
		(e: MouseEvent) => {
			if ((e.target as HTMLElement).closest("button")) return;
			onToggleExpand(project.id);
		},
		[project.id, onToggleExpand],
	);

	return (
		<div class="ep:flex ep:flex-col">
			<button
				type="button"
				class="ep:flex ep:items-center ep:gap-3 ep:py-3 ep:px-4 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors ep:border-b ep:border-obs-modifier-border ep:bg-transparent ep:border-x-0 ep:border-t-0 ep:font-inherit ep:text-left ep:w-full"
				onClick={handleHeaderClick}
			>
				<div class="ep:shrink-0 ep:flex ep:items-center ep:text-obs-muted [&_svg]:ep:w-4 [&_svg]:ep:h-4">
					<span ref={chevronRef} />
				</div>

				<div class="ep:font-medium ep:text-obs-normal ep:text-ui-small">
					{project.name}
				</div>

				<div class="ep:text-obs-muted ep:text-ui-smaller">{noteText}</div>

				{project.cardCount > 0 && (
					<div class="ep:shrink-0">
						<CardCountDisplay
							newCount={project.newCount}
							learningCount={project.learningCount}
							dueCount={project.dueCount}
							totalCount={project.cardCount}
						/>
					</div>
				)}

				<div class="ep:flex ep:items-center ep:gap-1 ep:shrink-0 ep:ml-auto">
					<IconButton
						icon="sliders-horizontal"
						ariaLabel="Custom study"
						size="small"
						onClick={() => onCustomStudyProject(project.name)}
					/>
					<IconButton
						icon="play"
						ariaLabel="Review project"
						size="small"
						onClick={() => onStartReviewProject(project.name)}
					/>
					<IconButton
						icon="plus"
						ariaLabel="Add note to project"
						size="small"
						onClick={() => onAddNotesToProject(project.name)}
					/>
				</div>
			</button>

			{isExpanded &&
				project.notes.map((note) => (
					<NoteHubNoteRow
						key={note.path}
						note={note}
						projectName={project.name}
						isSelected={selectedNotePaths.has(note.path)}
						selectionMode={selectionMode}
						onToggleSelection={onToggleNoteSelection}
						onEnterSelectionMode={onEnterSelectionMode}
						onOpenNote={onOpenNote}
						onStartReview={onStartReview}
						onCustomStudy={onCustomStudyNote}
						onGenerateCards={onGenerateCards}
						onAddToProject={onAddToProject}
						onRemoveFromProject={onRemoveFromProject}
					/>
				))}
		</div>
	);
}
