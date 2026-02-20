import { useCallback, useRef, useState } from "preact/hooks";
import { OptionCheckbox } from "../../../../shared/ui/components/OptionCheckbox";
import { ModalFooter } from "../../../../shared/ui/components/ModalFooter";
import {
	ExportScopeSelector,
	type ExportMode,
} from "../../components/ExportScopeSelector";
import type { NoteEntry } from "../../utils/export-helpers";

export interface ExportFormValues {
	exportMode: ExportMode;
	selectedProjects: Set<string>;
	selectedSourceUids: Set<string>;
	includeScheduling: boolean;
	includeMedia: boolean;
}

export interface FormPhaseProps {
	totalCards: number;
	allProjects: string[];
	allNotes: NoteEntry[];
	onExport: (values: ExportFormValues) => void;
	onClose: () => void;
}

export function FormPhase({
	totalCards,
	allProjects,
	allNotes,
	onExport,
	onClose,
}: FormPhaseProps) {
	const [exportMode, setExportMode] = useState<ExportMode>("all");
	const [includeScheduling, setIncludeScheduling] = useState(true);
	const [includeMedia, setIncludeMedia] = useState(true);
	const selectedProjects = useRef(new Set<string>());
	const selectedSourceUids = useRef(new Set<string>());

	const handleToggleProject = useCallback(
		(key: string, checked: boolean) => {
			if (checked) selectedProjects.current.add(key);
			else selectedProjects.current.delete(key);
		},
		[],
	);

	const handleToggleNote = useCallback(
		(key: string, checked: boolean) => {
			if (checked) selectedSourceUids.current.add(key);
			else selectedSourceUids.current.delete(key);
		},
		[],
	);

	const handleExport = useCallback(() => {
		onExport({
			exportMode,
			selectedProjects: selectedProjects.current,
			selectedSourceUids: selectedSourceUids.current,
			includeScheduling,
			includeMedia,
		});
	}, [exportMode, includeScheduling, includeMedia, onExport]);

	return (
		<>
			<ExportScopeSelector
				exportMode={exportMode}
				onModeChange={setExportMode}
				totalCards={totalCards}
				allProjects={allProjects}
				allNotes={allNotes}
				selectedProjects={selectedProjects.current}
				selectedSourceUids={selectedSourceUids.current}
				onToggleProject={handleToggleProject}
				onToggleNote={handleToggleNote}
			/>

			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Options</div>
				<OptionCheckbox
					label="Include scheduling data"
					description="Export review history and card progress"
					initialChecked={includeScheduling}
					onChange={setIncludeScheduling}
				/>
				<OptionCheckbox
					label="Include media"
					description="Export images and audio files"
					initialChecked={includeMedia}
					onChange={setIncludeMedia}
				/>
			</div>

			<ModalFooter
				onCancel={onClose}
				onConfirm={handleExport}
				confirmLabel="Export"
			/>
		</>
	);
}
