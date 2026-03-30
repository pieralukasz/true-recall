import {
	type ExportMode,
	ExportScopeSelector,
} from "@true-recall/obsidian/features/integration/components/ExportScopeSelector";
import type { NoteEntry } from "@true-recall/obsidian/features/integration/utils/export-helpers";
import { ModalFooter } from "@true-recall/obsidian/components/ModalFooter";
import { OptionCheckbox } from "@true-recall/obsidian/components/OptionCheckbox";
import { useCallback, useRef, useState } from "preact/hooks";

export interface ExportFormValues {
	exportMode: ExportMode;
	selectedSourceUids: Set<string>;
	includeScheduling: boolean;
	includeMedia: boolean;
}

export interface FormPhaseProps {
	totalCards: number;
	allNotes: NoteEntry[];
	onExport: (values: ExportFormValues) => void;
	onClose: () => void;
}

export function FormPhase({
	totalCards,
	allNotes,
	onExport,
	onClose,
}: FormPhaseProps) {
	const [exportMode, setExportMode] = useState<ExportMode>("all");
	const [includeScheduling, setIncludeScheduling] = useState(true);
	const [includeMedia, setIncludeMedia] = useState(true);
	const selectedSourceUids = useRef(new Set<string>());

	const handleToggleNote = useCallback((key: string, checked: boolean) => {
		if (checked) selectedSourceUids.current.add(key);
		else selectedSourceUids.current.delete(key);
	}, []);

	const handleExport = useCallback(() => {
		onExport({
			exportMode,
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
				allNotes={allNotes}
				selectedSourceUids={selectedSourceUids.current}
				onToggleNote={handleToggleNote}
			/>

			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Options</div>
				<OptionCheckbox
					label="Include scheduling data"
					description="Export review history and card progress"
					checked={includeScheduling}
					onChange={setIncludeScheduling}
				/>
				<OptionCheckbox
					label="Include media"
					description="Export images and audio files"
					checked={includeMedia}
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
