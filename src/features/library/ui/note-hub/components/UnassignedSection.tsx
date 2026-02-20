import { useCallback, useMemo } from "preact/hooks";
import type { SelectionMode } from "../../../../../shared/store";
import type { ProjectNoteInfo } from "../../../../../shared/types";
import { CardCountDisplay } from "../../../../../shared/ui/components";
import { useIcon } from "../../../../../shared/ui/preact/hooks";
import { NoteHubNoteRow } from "./NoteHubNoteRow";

export interface UnassignedSectionProps {
	notes: ProjectNoteInfo[];
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
	onCustomStudyNote: (filter: { sourceNoteFilters: string[] }) => void;
	onGenerateCards: (notePath: string) => void;
	onAddToProject: (notePath: string) => void;
	onRemoveFromProject: (notePath: string, projectName: string) => void;
}

export function UnassignedSection({
	notes,
	expandedProjectIds,
	selectionMode,
	selectedNotePaths,
	onToggleExpand,
	onToggleNoteSelection,
	onEnterSelectionMode,
	onOpenNote,
	onStartReview,
	onCustomStudyNote,
	onGenerateCards,
	onAddToProject,
	onRemoveFromProject,
}: UnassignedSectionProps) {
	const isExpanded = expandedProjectIds.has("__unassigned__");
	const chevronRef = useIcon(isExpanded ? "chevron-down" : "chevron-right");
	const noteText = notes.length === 1 ? "1 note" : `${notes.length} notes`;

	const totals = useMemo(() => {
		let totalNew = 0;
		let totalLearning = 0;
		let totalDue = 0;
		let totalCards = 0;
		for (const note of notes) {
			totalNew += note.newCount;
			totalLearning += note.learningCount;
			totalDue += note.dueCount;
			totalCards += note.cardCount;
		}
		return { totalNew, totalLearning, totalDue, totalCards };
	}, [notes]);

	const handleHeaderClick = useCallback(
		(e: MouseEvent) => {
			if ((e.target as HTMLElement).closest("button")) return;
			onToggleExpand("__unassigned__");
		},
		[onToggleExpand],
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
					Unassigned Notes
				</div>

				<div class="ep:text-obs-muted ep:text-ui-smaller">{noteText}</div>

				{totals.totalCards > 0 && (
					<div class="ep:shrink-0">
						<CardCountDisplay
							newCount={totals.totalNew}
							learningCount={totals.totalLearning}
							dueCount={totals.totalDue}
							totalCount={totals.totalCards}
						/>
					</div>
				)}
			</button>

			{isExpanded &&
				notes.map((note) => (
					<NoteHubNoteRow
						key={note.path}
						note={note}
						projectName={null}
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
