import type { SelectionMode } from "@shared/store";
import type { ProjectInfo, ProjectNoteInfo } from "@shared/types";
import { useIcon } from "@shared/ui/preact/hooks";

export interface SelectionFooterProps {
	selectionMode: SelectionMode;
	selectedNotePaths: Set<string>;
	projects: ProjectInfo[];
	unassignedNotes: ProjectNoteInfo[];
	onCancel: () => void;
	onBulkAddToProject: () => void;
	onBulkReview: () => void;
}

export function SelectionFooter({
	selectionMode,
	selectedNotePaths,
	projects,
	unassignedNotes,
	onCancel,
	onBulkAddToProject,
	onBulkReview,
}: SelectionFooterProps) {
	const cancelIcon = useIcon("x");
	const folderPlusIcon = useIcon("folder-plus");
	const playIcon = useIcon("play");

	if (selectionMode !== "selecting") return null;

	let newCount = 0;
	let learningCount = 0;
	let dueCount = 0;

	for (const project of projects) {
		for (const note of project.notes) {
			if (selectedNotePaths.has(note.path)) {
				newCount += note.newCount;
				learningCount += note.learningCount;
				dueCount += note.dueCount;
			}
		}
	}

	for (const note of unassignedNotes) {
		if (selectedNotePaths.has(note.path)) {
			newCount += note.newCount;
			learningCount += note.learningCount;
			dueCount += note.dueCount;
		}
	}

	const totalDue = newCount + learningCount + dueCount;

	const btnBase =
		"ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1.5 ep:rounded-md ep:text-ui-small ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";

	return (
		<div class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary">
			<div class="ep:flex ep:items-center ep:gap-2">
				<button
					type="button"
					class="clickable-icon"
					aria-label="Cancel selection"
					onClick={onCancel}
				>
					<span ref={cancelIcon} />
				</button>

				<span class="ep:flex ep:items-center ep:gap-1 ep:font-medium ep:text-ui-small">
					<span class="ep:text-obs-green">{newCount}</span>
					<span class="ep:text-obs-faint">&middot;</span>
					<span class="ep:text-obs-orange">{learningCount}</span>
					<span class="ep:text-obs-faint">&middot;</span>
					<span class="ep:text-obs-blue">{dueCount}</span>
				</span>
			</div>

			<div class="ep:flex ep:items-center ep:gap-2">
				<button
					type="button"
					class={`${btnBase} ep:bg-obs-modifier-hover ep:text-obs-normal ep:hover:bg-obs-interactive ep:hover:text-obs-on-accent`}
					onClick={onBulkAddToProject}
				>
					<span class="ep:flex ep:items-center" ref={folderPlusIcon} />
					<span>Add to Project</span>
				</button>

				<button
					type="button"
					class={`${btnBase} mod-cta${totalDue === 0 ? " ep:opacity-50 ep:cursor-not-allowed" : ""}`}
					disabled={totalDue === 0}
					onClick={totalDue === 0 ? undefined : onBulkReview}
				>
					<span class="ep:flex ep:items-center" ref={playIcon} />
					<span>Review Selected</span>
				</button>
			</div>
		</div>
	);
}
