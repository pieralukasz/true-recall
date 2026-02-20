import type { SelectionMode } from "@shared/store";
import type { ProjectInfo, ProjectNoteInfo } from "@shared/types";
import { EmptyState, LoadingSpinner } from "@shared/ui/components";
import { ProjectGroup } from "@features/library/ui/note-hub/components/ProjectGroup";
import { UnassignedSection } from "@features/library/ui/note-hub/components/UnassignedSection";

export interface NoteHubContentProps {
	isLoading: boolean;
	projects: ProjectInfo[];
	unassignedNotes: ProjectNoteInfo[];
	expandedProjectIds: Set<string>;
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

export function NoteHubContent({
	isLoading,
	projects,
	unassignedNotes,
	expandedProjectIds,
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
}: NoteHubContentProps) {
	if (isLoading) {
		return <LoadingSpinner />;
	}

	if (projects.length === 0 && unassignedNotes.length === 0) {
		return <EmptyState message="No notes with flashcards yet" />;
	}

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:overflow-y-auto ep:min-h-0">
			{projects.map((project) => (
				<ProjectGroup
					key={project.id}
					project={project}
					isExpanded={expandedProjectIds.has(project.id)}
					selectionMode={selectionMode}
					selectedNotePaths={selectedNotePaths}
					onToggleExpand={onToggleExpand}
					onToggleNoteSelection={onToggleNoteSelection}
					onEnterSelectionMode={onEnterSelectionMode}
					onOpenNote={onOpenNote}
					onStartReview={onStartReview}
					onStartReviewProject={onStartReviewProject}
					onCustomStudyProject={onCustomStudyProject}
					onCustomStudyNote={onCustomStudyNote}
					onGenerateCards={onGenerateCards}
					onAddToProject={onAddToProject}
					onRemoveFromProject={onRemoveFromProject}
					onAddNotesToProject={onAddNotesToProject}
				/>
			))}

			{unassignedNotes.length > 0 && (
				<UnassignedSection
					notes={unassignedNotes}
					expandedProjectIds={expandedProjectIds}
					selectionMode={selectionMode}
					selectedNotePaths={selectedNotePaths}
					onToggleExpand={onToggleExpand}
					onToggleNoteSelection={onToggleNoteSelection}
					onEnterSelectionMode={onEnterSelectionMode}
					onOpenNote={onOpenNote}
					onStartReview={onStartReview}
					onCustomStudyNote={onCustomStudyNote}
					onGenerateCards={onGenerateCards}
					onAddToProject={onAddToProject}
					onRemoveFromProject={onRemoveFromProject}
				/>
			)}
		</div>
	);
}
