import { CheckboxListItem } from "@shared/ui/components/CheckboxListItem";
import type { NoteEntry } from "@features/integration/utils/export-helpers";

export type ExportMode = "all" | "projects" | "notes";

export interface ExportScopeSelectorProps {
	exportMode: ExportMode;
	onModeChange: (mode: ExportMode) => void;
	totalCards: number;
	allProjects: string[];
	allNotes: NoteEntry[];
	selectedProjects: Set<string>;
	selectedSourceUids: Set<string>;
	onToggleProject: (key: string, checked: boolean) => void;
	onToggleNote: (key: string, checked: boolean) => void;
}

export function ExportScopeSelector({
	exportMode,
	onModeChange,
	totalCards,
	allProjects,
	allNotes,
	selectedProjects,
	selectedSourceUids,
	onToggleProject,
	onToggleNote,
}: ExportScopeSelectorProps) {
	return (
		<div class="ep:mb-4">
			<div class="ep:text-ui-small ep:font-medium ep:mb-2">Scope</div>

			<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
				<input
					id="export-scope-all"
					type="radio"
					name="export-scope"
					class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
					checked={exportMode === "all"}
					onChange={() => onModeChange("all")}
				/>
				<label htmlFor="export-scope-all" class="ep:text-ui-small">
					All cards ({totalCards})
				</label>
			</div>
			<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
				<input
					id="export-scope-projects"
					type="radio"
					name="export-scope"
					class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
					checked={exportMode === "projects"}
					onChange={() => onModeChange("projects")}
				/>
				<label htmlFor="export-scope-projects" class="ep:text-ui-small">
					Selected projects only
				</label>
			</div>
			<div class="ep:flex ep:items-center ep:gap-2 ep:py-1">
				<input
					id="export-scope-notes"
					type="radio"
					name="export-scope"
					class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
					checked={exportMode === "notes"}
					onChange={() => onModeChange("notes")}
				/>
				<label htmlFor="export-scope-notes" class="ep:text-ui-small">
					Selected notes only
				</label>
			</div>

			{allProjects.length > 0 && exportMode === "projects" && (
				<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6">
					{allProjects.map((project) => (
						<CheckboxListItem
							key={project}
							label={project}
							itemKey={project}
							selectedSet={selectedProjects}
							onToggle={onToggleProject}
						/>
					))}
				</div>
			)}

			{allNotes.length > 0 && exportMode === "notes" && (
				<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto ep:mt-2 ep:ml-6">
					{allNotes.map((note) => (
						<CheckboxListItem
							key={note.uid}
							label={note.name}
							itemKey={note.uid}
							selectedSet={selectedSourceUids}
							onToggle={onToggleNote}
						/>
					))}
				</div>
			)}
		</div>
	);
}
